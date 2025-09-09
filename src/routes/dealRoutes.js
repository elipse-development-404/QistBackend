const express = require('express');
const router = express.Router();
const { createDeal, getAllDeals, updateDeal, toggleDeal, deleteDeal } = require('../controllers/dealController');

router.post('/create-deal', createDeal);
router.get('/deal', getAllDeals);
router.put('/deal/:id', updateDeal);
router.patch('/deal/:id/toggle', toggleDeal);
router.delete('/deal/:id', deleteDeal);

module.exports = router;