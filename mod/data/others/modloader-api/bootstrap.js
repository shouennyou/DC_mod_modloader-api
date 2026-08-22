(function() {
	'use strict';

	const modloaderApi = window.modloaderApi;
	const api = modloaderApi && modloaderApi.ks;
	if (!api || typeof api.ensureHook !== 'function') {
		throw new Error('ModLoader API KS module is unavailable.');
	}
	if (!api.ensureHook()) {
		throw new Error('ModLoader API KS hook is not ready.');
	}

	const registration = modloaderApi.registration;
	if (!registration || typeof registration.waitForCompletion !== 'function') {
		throw new Error('ModLoader API registration module is unavailable.');
	}

	// bootstrap 是后续 KS 的启动闸门: API hook 和依赖模组注册都完成后才放行.
	const kag = window.TYRANO && window.TYRANO.kag;
	if (!kag || !kag.ftag || !kag.ftag.master_tag) {
		throw new Error('Tyrano KS runtime is unavailable.');
	}
	if (!kag.ftag.master_tag.modloader_bootstrap_wait) {
		kag.ftag.master_tag.modloader_bootstrap_wait = {
			start: function() {
				registration.waitForCompletion().then(function() {
					kag.ftag.nextOrder();
				});
			}
		};
	}

	modloaderApi.bootstrap = {
		ready: function() {
			return registration.status().result;
		},
		waitForReady: registration.waitForCompletion
	};
})();
