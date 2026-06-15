import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: false,
    },
    message: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      enum: ['customer', 'captain'],
      default: 'customer',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
