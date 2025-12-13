const bcrypt = require('bcrypt');

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function checkPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

(async () => {
    const password = "test123";

    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    console.log("hash1:", hash1);
    console.log("hash2:", hash2);

    console.log("hash1 === hash2 ?", hash1 === hash2); // ❌ false

    const isValid1 = await checkPassword(password, hash1);
    const isValid2 = await checkPassword(password, hash2);

    console.log("password vs hash1:", isValid1); // ✅ true
    console.log("password vs hash2:", isValid2); // ✅ true
})();