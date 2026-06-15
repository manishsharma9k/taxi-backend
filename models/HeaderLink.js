import mongoose from 'mongoose';

const headerLinkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  path: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, {
  timestamps: true,
});

export default mongoose.model('HeaderLink', headerLinkSchema);
