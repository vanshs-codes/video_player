import { Router } from "express";
import {
    loginUser,
    logoutUser,
    registerUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails, 
    updateUserAvatar,
    updateUserCoverImage,
    getChannelInfo,
    getUserWatchHistory
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js"
import { authenticateUser } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields(
        [
            {
                name: "avatar",
                maxCount: 1
            },
            {
                name: "coverImage",
                maxCount: 1
            }
        ]
    ),
    registerUser
);

router.route("/login").post(
    loginUser
)


// secured routes
router.route("/logout").post(
    authenticateUser,
    logoutUser
)

router.route("/refresh-token").post(
    refreshAccessToken
)

router.route("/change-password").post(
    authenticateUser,
    changeCurrentPassword
)

router.route("/get-user").get(
    authenticateUser,
    getCurrentUser
)

router.route("/update-details").patch(
    authenticateUser,
    updateUserDetails
)

router.route("/update-avatar").patch(
    authenticateUser,
    upload.single("avatar"),
    updateUserAvatar
)

router.route("/update-cover-image").patch(
    authenticateUser,
    upload.single("coverImage"),
    updateUserCoverImage
)

router.route("/fetch-info/:username").get(
    authenticateUser,
    getChannelInfo
)

router.route("/history").get(
    authenticateUser,
    getUserWatchHistory
)

export default router;