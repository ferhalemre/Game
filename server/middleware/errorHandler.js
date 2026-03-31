const errorHandler = (err, req, res, next) => {
  console.error('Hata:', err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Doğrulama hatası', details: errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `Bu ${field} zaten kullanılıyor` });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Geçersiz ID formatı' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Sunucu hatası'
  });
};

export default errorHandler;
