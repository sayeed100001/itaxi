const bcrypt = require('bcrypt');
console.log(bcrypt.hashSync('admin123', 10));
