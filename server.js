const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage Setup
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'techhub-products',
            public_id: `product_${Date.now()}_${Math.random()}`,
            allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
            transformation: [{ width: 800, height: 800, crop: 'limit' }]
        };
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images allowed!'), false);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// Schemas
const productSchema = new mongoose.Schema({
    name: String,
    category: String,
    price: Number,
    oldPrice: Number,
    description: String,
    images: [String], // Supports multiple images
    stock: { type: Number, default: 10 },
    createdAt: { type: Date, default: Date.now }
});

const offerSchema = new mongoose.Schema({
    title: String,
    discount: Number,
    originalPrice: Number,
    price: Number,
    description: String,
    image: String,
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const Offer = mongoose.model('Offer', offerSchema);

// Auth Middleware
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) next();
    else res.status(401).json({ msg: 'Unauthorized' });
};

// Routes
app.get('/api/auth/status', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (password === (process.env.ADMIN_PASSWORD || 'admin123')) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, msg: 'Wrong password' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Upload (Supports multiple images)
app.post('/api/upload', isAdmin, upload.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
    }
    res.json({ 
        success: true, 
        imageUrls: req.files.map(f => f.path)
    });
});

// Products
app.get('/api/products', async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
});

app.post('/api/products', isAdmin, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.json({ success: true, product });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Offers
app.get('/api/offers', async (req, res) => {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
});

app.post('/api/offers', isAdmin, async (req, res) => {
    try {
        const offer = new Offer(req.body);
        await offer.save();
        res.json({ success: true, offer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/offers/:id', isAdmin, async (req, res) => {
    await Offer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});