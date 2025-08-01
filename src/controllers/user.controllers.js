import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";

const registerUser = asyncHandler(async (req, res) => {
    const {username, email, fullName, password} = req.body;
    // fetching file path which has already been handled by multer
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    try {
        // ensuring none of the field is empty
        if(
            [username, email, fullName, password].some((field) => field?.trim() === "")
        ) {
            throw new ApiError(400, "a required field was empty");
        }
    
        // ensuring the user is registering for first time
        const userExists = await User.findOne({
            $or: [{ username }, { email }]
        })
        if (userExists) {
            throw new ApiError(400, "a user with this username or email already exists");
        }
    
        // uploading files on cloudinary
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
        // uploading on db
        const user = await User.create({
            username,
            email,
            fullName,
            password,
            avatar: avatar?.secure_url,
            coverImage: coverImage?.secure_url
        })
    
        const createdUser = user.toObject();
        delete createdUser.password;
        delete createdUser.refreshToken;
    
        // finally sending response
        return res.status(200).json(
            new ApiResponse(201, createdUser, "user registered successfully")
        )
    } finally {
        if(avatarLocalPath) fs.unlinkSync(avatarLocalPath);
        if(coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const {username, email, password} = req.body;

    // checking if user has provided valid username OR email
    if(!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    if(!user) {
        throw new ApiError(400, "invalid username or email")
    }

    // matching password with password from the database
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid) {
        throw new ApiError(400, "password incorrect")
    }

    // generating tokens
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    // adding refreshToken to db
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // removing token and password to send in response
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    // secure options for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    // finally sending response
    res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
            {
                user: userObj,
                accessToken,
                refreshToken
            },
            "logged in successfully")
    );
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "user logged out successfully")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if(!incomingRefreshToken) {
        throw new ApiError(400, "no token received")
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(400, "invalid or expired refresh token");
    }
    
    const user = await User.findById(decodedToken._id).select("-password");
    if(!user || !user.refreshToken || incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(400, "unauthorized request")
    }

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, { accessToken, refreshToken }, "access token refreshed successfully")
    )
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword, confirmPassword} = req.body;
    if(newPassword !== confirmPassword) {
        throw new ApiError(400, "confirm password does not match")
    }

    const user = await User.findById(req.user?._id);
    if(!user) {
        throw new ApiError(400, "bad request")
    }

    const isCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isCorrect) {
        throw new ApiError(400, "old password incorrect")
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "current user fetched successfully")
    )
})

const updateUserDetails = asyncHandler(async (req, res) => {
    const { username, email } = req.body;
    if(!username && !email) {
        throw new ApiError(400, "nothing to update")
    }

    const updateData = {}
    if(username) updateData.username = username
    if(email) updateData.email = email

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: updateData
        },
        { new: true }
    ).select("-password -refreshToken");

    if(!user) {
        throw new ApiError(500, "unable to update user details")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath) {
        throw new ApiError(400, "avatar not found")
    }

    try {
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        if(!avatar.secure_url) {
            throw new ApiError(500, "failed to upload avatar")
        }
    
        const user = await User.findById(req.user?._id).select("-password -refreshToken");
        if(!user) {
            throw new ApiError(404, "user not found, unable to update avatar");
        }
        const old_url = user.avatar;
    
        user.avatar = avatar.secure_url;
        await user.save({ validateBeforeSave: false });

        if(old_url) {
            deleteFromCloudinary(old_url, "image").catch((error) => {
                console.error(`failed to delete old avatar: ${old_url}`, error);
            });
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "avatar updated successfully")
        )
    } finally {
        fs.unlinkSync(avatarLocalPath);
    }
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath) {
        throw new ApiError(400, "cover image not found")
    }

    try {
        const coverImage = await uploadOnCloudinary(coverImageLocalPath);
        if(!coverImage.secure_url) {
            throw new ApiError(500, "failed to upload cover image")
        }
    
        const user = await User.findById(req.user?._id).select("-password -refreshToken");
        if(!user) {
            throw new ApiError(404, "user not found, unable to update avatar");
        }
        const old_url = user.coverImage;
    
        user.coverImage = coverImage.secure_url;
        await user.save({ validateBeforeSave: false });

        if(old_url) {
            deleteFromCloudinary(old_url, "image").catch((error) => {
                console.error(`failed to delete old avatar: ${old_url}`, error);
            });
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, user, "cover image updated successfully")
        )
    } finally {
        fs.unlinkSync(coverImageLocalPath);
    }
})

const getChannelInfo = asyncHandler(async (req, res) => {
    const {username} = req.params;
    if(!username?.trim()) {
        throw new ApiError(400, "invalid search")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribed"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                subscribedCount: {
                    $size: "$subscribed"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                subscribedCount: 1,
                isSubscribed: 1
            }
        }
    ])

    console.log("pipeline output -> ", channel);
    
    if(!channel?.length) {
        throw new ApiError(400, "channel not available")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "info fetched successfully")
    )
})

const getUserWatchHistory = asyncHandler(async (req, res) => {
    if(!req.user) {
        throw new ApiError(400, "invalid user, can't fetch watch history")
    }
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                                {
                                    $addFields: {
                                        owner: {
                                            $first: "$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getChannelInfo,
    getUserWatchHistory
};