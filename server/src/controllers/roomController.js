import Room from "../models/Room.js";


// CREATE VENUE / ROOM
export const createRoom = async (req, res) => {
  try {
    const {
      roomNo,
      capacity,
      type,
      category,
      requiredRoomCategory,
    } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------
    if (!roomNo) {
      return res.status(400).json({
        success: false,
        message: "Room number is required",
      });
    }

    if (
      capacity === undefined ||
      capacity === null ||
      capacity === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Room capacity is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Room type is required",
      });
    }

    if (!["lab", "class"].includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Room type must be either lab or class",
      });
    }

    // -----------------------------
    // Duplicate check
    // -----------------------------
    const existingRoom = await Room.findOne({
      roomNo: roomNo.trim(),
    });

    if (existingRoom) {
      return res.status(409).json({
        success: false,
        message: "Room already exists",
      });
    }

    // -----------------------------
    // Create room
    // -----------------------------
    const room = await Room.create({
      roomNo: roomNo.trim(),
      capacity: Number(capacity),
      type,
      category: category?.trim() || undefined,
      requiredRoomCategory:
        requiredRoomCategory?.trim() || undefined,
    });

    return res.status(201).json({
      success: true,
      message: "Venue created successfully",
      room,
    });
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create venue",
      error: error.message,
    });
  }
};


// GET ALL ROOMS
export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .sort({ roomNo: 1 });

    return res.status(200).json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error("GET ROOMS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch venues",
      error: error.message,
    });
  }
};


// GET SINGLE ROOM
export const getRoomById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    return res.status(200).json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("GET ROOM ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch venue",
      error: error.message,
    });
  }
};