import express from 'express';
import { adminProtect } from '../middlewares/authMiddleware.js';
import { getDashboardStats, getAllUsers, getAllCaptains, getAllContacts, deleteUser, deleteCaptain, approveCaptain, rejectCaptain, deleteContact, getAllRides, deleteRide, getHeaderLinks, createHeaderLink, updateHeaderLink, deleteHeaderLink, getPageContents, getPageContentByPath, createPageContent, updatePageContent, deletePageContent, getOnlineCaptains } from '../controllers/adminController.js';
import { getCaptainStats } from '../controllers/captainController.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/captains', getAllCaptains);
router.get('/online-captains', adminProtect, getOnlineCaptains);
router.get('/contacts', getAllContacts);

router.delete('/users/:id', deleteUser);
router.delete('/captains/:id', deleteCaptain);
router.get('/captains/:id/stats', getCaptainStats);
router.put('/captains/:id/approve', approveCaptain);
router.put('/captains/:id/reject', rejectCaptain);
router.delete('/contacts/:id', deleteContact);

router.get('/header-links', getHeaderLinks);
router.post('/header-links', adminProtect, createHeaderLink);
router.put('/header-links/:id', adminProtect, updateHeaderLink);
router.delete('/header-links/:id', adminProtect, deleteHeaderLink);

router.get('/page-content', getPageContentByPath);
router.get('/page-contents', adminProtect, getPageContents);
router.post('/page-contents', adminProtect, createPageContent);
router.put('/page-contents/:id', adminProtect, updatePageContent);
router.delete('/page-contents/:id', adminProtect, deletePageContent);

router.get('/rides', getAllRides);
router.delete('/rides/:id', deleteRide);

export default router;
