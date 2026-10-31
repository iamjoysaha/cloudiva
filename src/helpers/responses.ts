export const responseMessages = {
  public: {
    success: {
      register: "Account created successfully.",
      login: "Login successful.",
      user: "User found.",
    },
    error: {
      register: "Failed to create account. Please try again.",
      login: "Failed to login. Please try again.",
      token: "Token is required!",
      credentials: "Invalid credentials!",
      payload: "Missing required fields from payload.",
      object: "Invalid object provided.",
      user: "User not found.",
    },
  },
  middlewares: {
    success: {
      auth: "Authentication successful.",
      access: "Access granted.",
    },
    error: {
      auth: "Authentication failed.",
      access: "Unauthorized access.",
      token: "Invalid or expired token.",
    },
  },
  user: {
    success: {
      details: "User details fetched successfully.",
      logout: "Logged out successfully.",
    },
    error: {
      details: "Unable to fetch user details.",
      logout: "Unable to logout.",
    },
  },
  folder: {
    success: {
      create: "Folder created successfully.",
      found: "Folder fetched successfully.",
    },
    error: {
      create: "Unable to create folder. Please try again.",
      notFound: "Folder not found.",
    },
  },
  file: {
    success: {
      upload: "Files uploaded successfully.",
      found: "Files fetched successfully.",
    },
    error: {
      upload: "Unable to upload files. Please try again later.",
      notFound: "Files not found."
    },
  }
};
