import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', required: true },
  sender: { type: String, enum: ['admin', 'captain'], required: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  deletedFor: [{ type: String, enum: ['admin', 'captain'] }], // soft delete per side
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;
