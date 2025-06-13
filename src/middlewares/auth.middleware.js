import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const authenticateUser = asyncHandler(async (req, _, next) => {
    const bearerToken = req.header("Authorization")
    const token = req.cookies?.accessToken || (bearerToken?.startsWith("Bearer ") ? bearerToken.replace("Bearer ", "") : null);
    
    if(!token) {
        throw new ApiError(400, "access token absent")
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decodedToken._id).select("-password -refreshToken");
    if(!user) {
        throw new ApiError(400, "invalid request")
    }

    req.user = user;

    next();
})