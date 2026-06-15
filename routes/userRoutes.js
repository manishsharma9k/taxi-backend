import express from 'express';
import { getUsers, getUserById, addUser, updateUser, deleteUser } from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/add', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
