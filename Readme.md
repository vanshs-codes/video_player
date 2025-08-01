# Video_Player - A Video Platform Backend

video_player is a robust backend service for a modern video-sharing platform, inspired by services like YouTube and Netflix. It provides a complete set of features for user authentication, video content management, and data aggregation, built with a focus on security, scalability, and performance.

This project demonstrates a deep understanding of backend development principles, including secure API design, database management, and cloud integration.

---

## ✨ Key Features

* **Secure Authentication & Authorization**:
    * **JWT-based Authentication**: Implements a secure authentication system using short-lived access tokens and long-lived refresh tokens, enhancing security by minimizing the exposure of access tokens.
    * **Password Hashing**: Uses `bcrypt` to hash user passwords before storing them, protecting user credentials against database breaches.
    * **Protected Routes**: Middleware ensures that sensitive operations (like updating or deleting content) can only be performed by authenticated and authorized users.

* **Complete User & Channel Management**:
    * Full user lifecycle management: register, login, logout.
    * Users can update their personal details, password, and profile images (avatar and cover image).
    * Public-facing channel pages to display user-specific content.
    * Functionality to track and retrieve a user's personal watch history.

* **Full-Fledged Video Content Management**:
    * Complete CRUD (Create, Read, Update, Delete) operations for video content.
    * Users have full control over the publishing status of their videos, allowing for private/unlisted content.

* **Cloud Media Management**:
    * Seamless integration with **Cloudinary** for robust video and image hosting, processing, and delivery via its global CDN.
    * Automated cleanup of old assets from the cloud when they are updated or deleted, preventing orphaned files and managing storage costs.

* **Advanced Data Aggregation & Filtering**:
    * Powerful **MongoDB Aggregation Pipelines** for dynamic data retrieval.
    * Features include text-based search, server-side pagination for handling large datasets, and dynamic sorting.

---

## 🛠️ Tech Stack & Architecture

This project is built using the MERN stack, with a focus on creating a scalable and maintainable backend architecture.

| Category          | Technology                                                                                                  | Why it was chosen                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime** | **Node.js** | Provides a fast, scalable, and event-driven environment perfect for building real-time and data-intensive backend services.                      |
| **Framework** | **Express.js** | A minimal and flexible framework that provides a robust set of features for web applications, simplifying routing and middleware management. |
| **Database** | **MongoDB (with MongoDB Atlas)** | A NoSQL database chosen for its flexible schema design, which is ideal for handling complex, nested data like user profiles and video metadata.   |
| **ODM** | **Mongoose** | An Object Data Modeling (ODM) library that provides a straightforward, schema-based solution to model application data, enforce validation, and encapsulate business logic using custom methods and middleware (`pre` hooks).      |
| **Authentication**| **JSON Web Tokens (JWT) & bcrypt** | JWT for creating secure, stateless authentication tokens (access and refresh). `bcrypt` for industry-standard password hashing.          |
| **File Handling** | **Cloudinary & Multer** | **Multer** for handling incoming `multipart/form-data` efficiently. **Cloudinary** for offloading media storage, providing powerful transformations, and fast delivery via its CDN. |

---

## 🚀 API Endpoints

The API is versioned under `/api/v1`.

### User Routes (`/api/v1/users`)

| HTTP Method | Route                     | Description                                      | Protected |
| :---------- | :------------------------ | :----------------------------------------------- | :-------- |
| `POST`      | `/register`               | Register a new user with avatar/cover image.     | **No** |
| `POST`      | `/login`                  | Log in a user and return access/refresh tokens.  | **No** |
| `POST`      | `/logout`                 | Log out the current user (clears cookies and refresh token). | **Yes** |
| `POST`      | `/refresh-token`          | Obtain a new access token using a refresh token. | **Yes** |
| `POST`      | `/change-password`        | Change the current user's password.              | **Yes** |
| `GET`       | `/get-user`               | Get the profile of the currently logged-in user. | **Yes** |
| `PATCH`     | `/update-details`         | Update the full name and email of the user.      | **Yes** |
| `PATCH`     | `/update-avatar`          | Update the user's avatar image.                  | **Yes** |
| `PATCH`     | `/update-cover-image`     | Update the user's cover image.                   | **Yes** |
| `GET`       | `/fetch-info/:username`   | Get public channel information for a user.       | **No** |
| `GET`       | `/history`                | Get the watch history of the logged-in user.     | **Yes** |

### Video Routes (`/api/v1/videos`)

| HTTP Method | Route                     | Description                                      | Protected |
| :---------- | :------------------------ | :----------------------------------------------- | :-------- |
| `GET`       | `/`                       | Get all videos with pagination, sorting & search.| **No** |
| `POST`      | `/publish`                | Publish a new video (requires file uploads).     | **Yes** |
| `GET`       | `/:videoId`               | Get a single video by its ID.                    | **No** |
| `PATCH`     | `/:videoId`               | Update video details (title, thumbnail, etc.).   | **Yes** |
| `DELETE`    | `/:videoId`               | Delete a video and its assets from the cloud.    | **Yes** |
| `PATCH`     | `/toggle/publish/:videoId`| Toggle the `isPublished` status of a video.      | **Yes** |

---

## ⚙️ Environment Variables

To run this project, you will need to add the following environment variables to your `.env` file:

`PORT=8000`    
`MONGODB_URI=`    
`CORS_ORIGIN=*`    

`CLOUDINARY_CLOUD_NAME=`    
`CLOUDINARY_API_KEY=`    
`CLOUDINARY_API_SECRET=`    

`ACCESS_TOKEN_SECRET=`    
`ACCESS_TOKEN_EXPIRY=`    
`REFRESH_TOKEN_SECRET=`    
`REFRESH_TOKEN_EXPIRY=`    

---

## Local Installation & Setup

Follow these steps to get the project up and running on your local machine.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vanshs-codes/video_player.git
    cd video_player
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    * Create a `.env` file in the root of the project.
    * Copy the contents from the `Environment Variables` section above and provide your own values.

4.  **Start the server:**
    ```bash
    npm run dev
    ```

The server will start on the port specified in your `.env` file (e.g., `http://localhost:8000`).

---

## 🔮 Future Improvements

* **Implement a Subscription Model**: Allow users to subscribe to channels and get a personalized feed.
* **Add Likes and Comments**: Introduce social features for user engagement on videos.
* **Create Playlists**: Enable users to organize videos into personal or public playlists.
* **Optimize Search**: Transition from `$regex` to MongoDB's more efficient `$text` search with a dedicated text index for better performance on large datasets.
* **Implement Caching**: Use a caching layer like Redis to cache frequently accessed data (e.g., popular videos, user profiles) to reduce database load and improve response times.

