const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  facultyId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  noOfClassesPe5rDay: { type: Number, required: true },
  designation: {
    type: String,
    enum: ['Assistant Professor', 'HOD', 'Professor'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Faculty', facultySchema);