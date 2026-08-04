const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNo: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    type: { type: String, enum: ["lab", "class"], required: true },
    category: {type: String},
    requiredRoomCategory: {type: String},
  },
  { timestamps: true },
);

module.exports = mongoose.model("Room", roomSchema);
