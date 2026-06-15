import mongoose from 'mongoose';

const pageContentSchema = new mongoose.Schema({
  path: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, {
  timestamps: true,
});

export default mongoose.model('PageContent', pageContentSchema);
