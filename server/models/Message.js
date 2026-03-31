import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true, maxlength: 100 },
  body: { type: String, required: true, maxlength: 5000 },
  read: { type: Boolean, default: false },
  deletedBySender: { type: Boolean, default: false },
  deletedByReceiver: { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ to: 1, read: 1, createdAt: -1 });
messageSchema.index({ from: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
