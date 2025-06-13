import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const registerUser = asyncHandler(async (req, res) => {
    const {username, email, fullName, password} = req.body;

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

    // fetching file path which has already been handled by multer
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

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

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser) {
        throw new ApiError(500, "something went wrong while registering user");
    }

    // finally sending response
    return res.status(200).json(
        new ApiResponse(201, createdUser, "user registered successfully")
    )
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

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath) {
        throw new ApiError(400, "avatar not found")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.secure_url) {
        throw new ApiError(500, "failed to upload avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.secure_url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath) {
        throw new ApiError(400, "cover image not found")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.secure_url) {
        throw new ApiError(500, "failed to upload cover image")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.secure_url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover image updated successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserAvatar,
    updateUserCoverImage
};