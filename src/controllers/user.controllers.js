import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    const {username, email, fullName, password} = req.body;

    // ensuring none of the field is empty
    if(
        [username, email, fullName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "a required field was empty");
    }

    // ensuring the user is registering for first time
    const userExists = User.findOne({
        $or: [{ username }, { email }]
    })
    if (userExists) {
        throw new ApiError(400, "user already exists");
    }

    // fetching file path which has already been handled by multer
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0].path;
    if(!avatarLocalPath) {
        throw new ApiError(400, "avatar is required");
    }

    // uploading files on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar) {
        throw new ApiError(500, "something went wrong while uploading avatar");
    }

    // uploading on db
    const user = await User.create({
        username,
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
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

export { registerUser };