import mongoose, { isValidObjectId, Mongoose } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    const pipeline = [];    // dynamic pipeline depending on what params of query are present
    
    if (userId) {
        if (!Mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, "Invalid userId format");
        }
        pipeline.push({
            $match: {
                owner: new Mongoose.Types.ObjectId(userId),
            },
        });
    }

    // fetch unpublished as well if checking own videos
    let publishedFilter = { isPublished: true };
    if(req.user && userId && req.user._id.toString() === userId) {
        publishedFilter = {};
    }
    pipeline.push({
        $match: publishedFilter
    });

    if(query) {
        pipeline.push({
            $match: {
                $or: [
                    {
                        title: {
                            $regex: query,
                            $options: "i"
                        }
                    },
                    {
                        description: {
                            $regex: query,
                            $options: "i"
                        }
                    }
                ]
            }
        });
    }

    const sortOptions = {};
    if(sortBy) {
        sortOptions[sortBy] = sortType === "desc" ? -1 : 1;
    }
    else {
        sortOptions["createdAt"] = -1;  // default sort by latest
    }
    pipeline.push({ $sort: sortOptions });

    // pagination
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };
    
    const aggregate = Video.aggregate(pipeline);

    const videos = await Video.aggregatePaginate(aggregate, options);

    if (!videos || videos.docs.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No videos found"));
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if(!title) {
        throw new ApiError(400, "title is required");
    }
    
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    if(!videoFileLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "required files missing");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if(!videoFile || !thumbnail) {
        throw new ApiError(500, "failed to upload video");
    }

    const video = await Video.create({
        videoFile: videoFile.secure_url,
        thumbnail: thumbnail.secure_url,
        owner: req.user._id,
        title,
        description,
        duration: videoFile.duration,
    });

    if(!video) {
        throw new ApiError(500, "something went wrong while publishing video");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, video, "video published successfully")
    );
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId || !Mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "requested id is not valid");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "no such video exists");
    }

    // checking if the video is published
    if(!video.isPublished && video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to view this video");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, video, "video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if(!videoId || !Mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "invalid update request");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "no such video exists, unable to update");
    }

    if(video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "user unauthorized to edit video details");
    }

    const { title, description } = req.body;
    const thumbnailLocalPath = req.files?.thumbnail?.path;

    const updateData = {};
    if(title) updateData.title = title;
    if(description) updateData.description = description;

    if(thumbnailLocalPath) {
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if(!thumbnail) {
            throw new ApiError(500, "something went wrong while uploading thumbnail");
        }
        updateData.thumbnail = thumbnail.secure_url;
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: updateData
        },
        { new: true }
    );

    if(!updatedVideo) {
        throw new ApiError(500, "failed to update video data");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "video details updated successfully")
    );
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId || !Mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "no video provided to delete");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "no such video exists, delete not possible");
    }

    if(req.user._id.toString() !== video.owner.toString()) {
        throw new ApiError(403, "user unauthorized to delete this video");
    }

    const result = await Video.findByIdAndDelete(videoId);

    if(!result) {
        throw new ApiError(500, "failed to delete video");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "video successfully deleted")
    );
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!videoId || !Mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "bad request to toggle publish status");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "video not found, unable to toggle publish status");
    }

    if(video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "user unauthorized, unable to toggle publish status");
    }

    const currStatus = video.isPublished;

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            isPublished: !currStatus
        },
        { new: true }
    );

    if(!updatedVideo || updatedVideo.isPublished === currStatus) {
        throw new ApiError(500, "failed to toggle publish status");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedVideo, "publish status toggled successfully")
    );
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}