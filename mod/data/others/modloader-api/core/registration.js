/**
 * 依赖 modloader-api 的模组注册握手。
 * 模组应在自己的注入脚本完成初始化后调用:
 *   window.modloaderApi.registration.complete('my-mod-id', true)
 */
(function() {
	'use strict';

	const global = window;
	const modloader = global.modloaderApi || (global.modloaderApi = {});
	if (modloader.registration) return;

	const state = {
		expected: new Set(),
		completed: new Map(),
		listeners: [],
		settled: false,
		result: null,
		promise: null,
		resolve: null,
		readAttempts: 0,
		expectedLogged: false
	};

	function emit(event) {
		state.listeners.slice().forEach(function(listener) {
			try { listener(event); } catch (error) { console.error('[ModLoader API] 注册事件监听器失败:', error); }
		});
		if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
			global.dispatchEvent(new CustomEvent('modloader-api-registration', { detail: event }));
		}
	}

	function getCounts() {
		const items = Array.from(state.completed.values());
		return {
			success: items.filter(item => item.success).length,
			failed: items.filter(item => !item.success).length,
			total: state.expected.size
		};
	}

	function finishIfReady() {
		if (state.settled || state.completed.size < state.expected.size) return;
		state.settled = true;
		const counts = getCounts();
		const failed = Array.from(state.completed.values()).filter(item => !item.success);
		state.result = {
			success: failed.length === 0,
			expected: state.expected.size,
			completed: state.completed.size,
			successCount: counts.success,
			failureCount: counts.failed,
			failed: failed.map(item => item.id),
			items: Array.from(state.completed.values())
		};
		console.log('[ModLoader API] 全部模组注册完毕 (成功: ' + counts.success + ', 失败: ' + counts.failed + ', 总共: ' + counts.total + ')' + (state.result.success ? '，继续启动游戏。' : '，存在注册失败，继续启动游戏。'));
		if (state.resolve) state.resolve(state.result);
		emit({ type: state.result.success ? 'ready' : 'failed', ...state.result });
	}

	function readExpected() {
		const api = global.modloader;
		if (!api || typeof api.readFileSync !== 'function') return false;
		try {
			const raw = api.readFileSync('cache/mod-info.json');
			const data = JSON.parse(raw || '{}');
			const entries = Array.isArray(data.entries) ? data.entries : [];
			entries.forEach(function(entry) {
				const depends = entry && entry.metadata && entry.metadata.depends;
				const id = entry && entry.metadata && entry.metadata.id;
				if (entry && entry.enabled === true && id && depends && Object.prototype.hasOwnProperty.call(depends, 'modloader-api')) {
					state.expected.add(String(id));
				}
			});
			if (!state.expectedLogged) {
				state.expectedLogged = true;
				console.log('[ModLoader API] 识别到需要注册模组 (成功: 0, 失败: 0, 总共: ' + state.expected.size + ')' + (state.expected.size ? ' [' + Array.from(state.expected).join(', ') + ']' : ''));
			}
			return true;
		} catch (error) {
			console.warn('[ModLoader API] 读取 cache/mod-info.json 失败:', error);
			return false;
		}
	}

	function initialize() {
		if (readExpected()) {
			finishIfReady();
			return;
		}
		state.readAttempts += 1;
		if (state.readAttempts >= 50) {
			console.warn('[ModLoader API] 无法读取模组缓存，将按无依赖模组继续启动。');
			if (!state.expectedLogged) {
				state.expectedLogged = true;
				console.log('[ModLoader API] 识别到需要注册模组 (成功: 0, 失败: 0, 总共: 0)');
			}
			finishIfReady();
			return;
		}
		global.setTimeout(initialize, 100);
	}

	const registration = {
		complete: function(id, success, detail) {
			const key = String(id || '').trim();
			if (!key || state.settled || !state.expected.has(key) || state.completed.has(key)) return false;
			const event = { type: success === false ? 'failure' : 'success', id: key, success: success !== false, detail: detail === undefined ? null : detail };
			state.completed.set(key, event);
			const counts = getCounts();
			console.log('[ModLoader API] 收到注册事件: ' + key + ' ' + (event.success ? '成功' : '失败') + ' (成功: ' + counts.success + ', 失败: ' + counts.failed + ', 总共: ' + counts.total + ')' + (event.detail ? ' ' + String(event.detail) : ''));
			emit(event);
			finishIfReady();
			return true;
		},
		onRegistration: function(listener) {
			if (typeof listener !== 'function') return function() {};
			state.listeners.push(listener);
			return function() {
				const index = state.listeners.indexOf(listener);
				if (index !== -1) state.listeners.splice(index, 1);
			};
		},
		waitForCompletion: function() {
			if (state.settled) return Promise.resolve(state.result);
			if (!state.promise) state.promise = new Promise(resolve => { state.resolve = resolve; });
			finishIfReady();
			return state.promise;
		},
		status: function() {
			return { expected: state.expected.size, completed: state.completed.size, pending: Array.from(state.expected).filter(id => !state.completed.has(id)), result: state.result };
		}
	};
	registration.report = registration.complete;
	registration.onComplete = registration.onRegistration;

	modloader.registration = registration;
	initialize();
})();
