(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    window.QAMode = Object.freeze({
        enabled: params.get('qa') === '1'
    });
})();
