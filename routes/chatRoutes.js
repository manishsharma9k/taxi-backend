import express from 'express';
import Message from '../models/Message.js';
import Captain from '../models/Captain.js';
import { io, adminOnline } from '../server.js';

const router = express.Router();

// GET all captains with last message (for admin chat list)
router.get('/captains', async (req, res) => {
  try {
    const captains = await Captain.find({}, 'name phone vehicleType isOnline customId');
    const list = await Promise.all(captains.map(async (c) => {
      const last = await Message.findOne({ captainId: c._id }).sort({ createdAt: -1 });
      return { captain: c, lastMessage: last || null };
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET messages for a captain (exclude messages deleted for that side)
router.get('/:captainId', async (req, res) => {
  try {
    const role = req.query.role || 'admin'; // 'admin' or 'captain'
    const msgs = await Message.find({
      captainId: req.params.captainId,
      deletedFor: { $ne: role },
    }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE single message (soft delete for one side)
router.delete('/message/:messageId', async (req, res) => {
  const { role } = req.body; // 'admin' or 'captain'
  try {
    const msg = await Message.findByIdAndUpdate(
      req.params.messageId,
      { $addToSet: { deletedFor: role } },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    // Notify both sides via socket
    io.to(`captain_${msg.captainId}`).emit('chat:messageDeleted', { messageId: msg._id, role });
    io.to('admin_room').emit('chat:messageDeleted', { messageId: msg._id, role });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE entire chat for one side
router.delete('/chat/:captainId', async (req, res) => {
  const { role } = req.body; // 'admin' or 'captain'
  try {
    await Message.updateMany(
      { captainId: req.params.captainId, deletedFor: { $ne: role } },
      { $addToSet: { deletedFor: role } }
    );
    io.to(`captain_${req.params.captainId}`).emit('chat:cleared', { captainId: req.params.captainId, role });
    io.to('admin_room').emit('chat:cleared', { captainId: req.params.captainId, role });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST send message
router.post('/send', async (req, res) => {
  const { captainId, text, sender } = req.body;
  if (!captainId || !text || !sender) return res.status(400).json({ message: 'Missing fields' });
  try {
    const captain = await Captain.findById(captainId);
    const captainIsOnline = captain?.isOnline || false;

    // read = true only if the RECEIVER is online
    // admin sends → receiver is captain → check captainIsOnline
    // captain sends → receiver is admin → check adminOnline
    const read = sender === 'admin' ? captainIsOnline : adminOnline;

    const msg = await Message.create({ captainId, sender, text, read });
    const payload = { captainId, sender, text, read, createdAt: msg.createdAt, _id: msg._id };

    io.to(`captain_${captainId}`).emit('chat:message', payload);
    io.to('admin_room').emit('chat:message', payload);
    res.json(msg);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH mark message as read
router.patch('/read/:messageId', async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.messageId, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
