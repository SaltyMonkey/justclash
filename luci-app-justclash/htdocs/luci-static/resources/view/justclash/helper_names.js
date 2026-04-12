"use strict";
"require baseclass";

return baseclass.extend({
    adjectives: [
        "silent", "rapid", "bright", "calm", "solid", "swift",
        "sharp", "steady", "wild", "clear", "bold", "smart",
        "brisk", "clean", "cool", "eager", "fine", "fresh",
        "gentle", "grand", "keen", "light", "lucky", "quick"
    ],

    nouns: [
        "fox", "wolf", "owl", "hawk", "raven", "panda",
        "tiger", "otter", "lynx", "bear", "falcon", "yak",
        "eagle", "shark", "whale", "dolphin", "badger", "cobra",
        "moose", "rabbit", "beaver", "goose", "horse", "koala"
    ],

    _pickFromArrRandomly: function (arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            throw new Error("Expected non-empty array");

        return arr[Math.floor(Math.random() * arr.length)];
    },

    _generateSuffix: function (len) {
        var chars = "abcdef0123456789";
        var out = "";

        if (!Number.isInteger(len) || len <= 0)
            throw new Error("Expected positive integer length");

        while (out.length < len)
            out += chars.charAt(Math.floor(Math.random() * chars.length));

        return out;
    },

    generateRandomName: function () {
        return this._pickFromArrRandomly(this.adjectives) + "-" +
            this._pickFromArrRandomly(this.nouns) + "-" +
            this._generateSuffix(4);
    }
});