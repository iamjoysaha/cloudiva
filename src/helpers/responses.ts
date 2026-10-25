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
    },
    error: {
      details: "Unable to fetch user details.",
    },
  },
};
