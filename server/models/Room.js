const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNo: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    type: { type: String, enum: ["lab", "class"], required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Room", roomSchema);
