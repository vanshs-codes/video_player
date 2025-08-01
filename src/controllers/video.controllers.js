import { Mongoose } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"
import fs from "fs"


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
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    try {
        if(!title) {
            throw new ApiError(400, "title is required");
        }
        
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
    } finally {
        if(videoFileLocalPath) fs.unlinkSync(videoFileLocalPath);
        if(thumbnailLocalPath) fs.unlinkSync(thumbnailLocalPath);
    }
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

    const isOwner = req.user && video.owner.toString() === req.user._id.toString();

    // checking if the video is published
    if(!video.isPublished && !isOwner) {
        throw new ApiError(403, "You do not have permission to view this video");
    }

    // incrementing views
    if (!isOwner) {
        Video.findByIdAndUpdate(videoId, {
            $inc: {
                views: 1
            }
        }).exec();
    }

    // add to user watch history
    if (req.user && !isOwner) {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: {
                watchHistory: videoId
            }
        });
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, video, "video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;

    try {
        if(!videoId || !Mongoose.Types.ObjectId.isValid(videoId)) {
            throw new ApiError(400, "invalid update request");
        }
    
        const video = await Video.findById(videoId);
        if(!video) {
            throw new ApiError(404, "no such video exists, unable to update");
        }
    
        if(video.owner.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "user unauthorized to edit video details");
        }

        const oldThumbnail = video.thumbnail;
    
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

        if(updateData.thumbnail && oldThumbnail) {
            deleteFromCloudinary(oldThumbnail, "image").catch((error) => {
                console.error("failed to delete thumbnail from cloudinary, url: ", oldThumbnail);
            })
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "video details updated successfully")
        );
    } finally {
        if(thumbnailLocalPath) fs.unlinkSync(thumbnailLocalPath);
    }
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

    const videoFile = video.videoFile;
    const thumbnail = video.thumbnail;

    if(req.user._id.toString() !== video.owner.toString()) {
        throw new ApiError(403, "user unauthorized to delete this video");
    }

    const result = await Video.findByIdAndDelete(videoId);

    if(!result) {
        throw new ApiError(500, "failed to delete video");
    }

    if(videoFile) {
        deleteFromCloudinary(videoFile, "video").catch((error) => {
            console.error("failed to delete video file from cloudinary, url: ", videoFile);
        })
    }

    if(thumbnail) {
        deleteFromCloudinary(thumbnail, "image").catch((error) => {
            console.error("failed to delete thumbnail from cloudinary, url: ", thumbnail);
        })
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