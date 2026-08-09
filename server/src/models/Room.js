import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomNo: {
      type: String,
      required: true,
      unique: true,
    },

    capacity: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ["lab", "class"],
      required: true,
    },

    category: {
      type: String,
    },

    requiredRoomCategory: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const Room = mongoose.model("Room", roomSchema);

export default Room;
