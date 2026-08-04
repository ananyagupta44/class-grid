const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  noOfClasses: { type: Number, required: true },
  type: { type: String, enum: ['theory', 'lab'], required: true },
  credits: { type: Number, required: true },
  ltp: {
    type: [Number], // [L, T, P]
    validate: {
      validator: (arr) => arr.length === 3,
      message: 'LTP must have exactly 3 values [L, T, P]',
    },
  },
  category: { type: String, enum: ['elective', 'course'], default: 'course' },
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);