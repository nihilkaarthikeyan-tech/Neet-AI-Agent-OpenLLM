import bcrypt from 'bcryptjs';

const hash = '$2b$12$Gv12TWcNXD5ucT.ve9CN6evRZhvxrG8hnYBT6lcOw93HCh9Bi17Xm';
const pass1 = 'password';
const pass2 = 'password123';
const pass3 = '12345678';

async function main() {
  console.log('password', await bcrypt.compare(pass1, hash));
  console.log('password123', await bcrypt.compare(pass2, hash));
  console.log('12345678', await bcrypt.compare(pass3, hash));
}
main();
