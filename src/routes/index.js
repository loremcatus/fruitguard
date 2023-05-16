import express from 'express';
import { getUsers, getUser, addUser, updateUser, deleteUser } from '../modules/controllers/userController.js';
import { getCampaigns } from '../modules/controllers/campaignController.js';
import { addCampaign } from '../modules/controllers/campaignController.js';

export const router = express.Router();

// Usuarios
router.get('/api/users', getUsers);
router.get('/api/users/:id', getUser);
router.post('/api/users', addUser);
router.patch('/api/users/:id', updateUser);
router.delete('/api/users/:id', deleteUser);

// Campañas
router.get('/campaigns', getCampaigns);

router.post('/api/campaigns', addCampaign);
