AES = {
    Encrypt: function (sKey, sText) {
        if (!sText)
            return null;
        try {
            var hash = CryptoJS.MD5(sKey).toString().toUpperCase();
            var key = CryptoJS.enc.Utf8.parse(hash);
            var Messagewords = CryptoJS.enc.Utf8.parse(sText);
            var encrypted = CryptoJS.AES.encrypt(Messagewords, key, { mode: CryptoJS.mode.ECB });
            var base64 = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
            return base64.toString().replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '$');
        } catch (e) {
        }
        return null;
    },
    Decrypt: function (sKey, sText) {
        if (!sText)
            return null;
        try {
            sText = sText.replace(/-/g, '+').replace(/_/g, '/').replace(/\$/g, '=');
            var hash = CryptoJS.MD5(sKey).toString().toUpperCase();
            var key = CryptoJS.enc.Utf8.parse(hash);
            var cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Base64.parse(sText)
            });
            var decrypted = CryptoJS.AES.decrypt(cipherParams, key, { mode: CryptoJS.mode.ECB });
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (e) {
        }
        return null;
    }
}