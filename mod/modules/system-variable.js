/**
 * 系统变量修改模块。
 * 支持直接修改和临时修改两种模式。
 * 临时修改记录到 IndexedDB，每次启动时先回滚旧的临时修改，再重新注入所有修改。
 */
(function() {
	'use strict';

	const helper = modloader.ModHelper;
	const runtime = modloader.ModuleRuntime.createRuntime({
		tag: '系统变量助手',
		color: '#ff5722',
		retryInterval: 100,
		debug: true
	});

	const DB_NAME = 'modloader_sysvar';
	const DB_VERSION = 1;
	const STORE_NAME = 'temp_patches';

	const state = {
		directPatches: [],
		tempPatches: [],
		applied: false
	};

	function openDB() {
		return new Promise(function(resolve, reject) {
			var request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = function(event) {
				var db = event.target.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'key' });
				}
			};
			request.onsuccess = function(event) { resolve(event.target.result); };
			request.onerror = function(event) { reject(event.target.error); };
		});
	}

	function loadTempRecords() {
		return openDB().then(function(db) {
			return new Promise(function(resolve, reject) {
				var tx = db.transaction(STORE_NAME, 'readonly');
				var store = tx.objectStore(STORE_NAME);
				var request = store.getAll();
				request.onsuccess = function() { resolve(request.result || []); };
				request.onerror = function() { reject(request.error); };
			});
		});
	}

	function saveTempRecords(records) {
		return openDB().then(function(db) {
			return new Promise(function(resolve, reject) {
				var tx = db.transaction(STORE_NAME, 'readwrite');
				var store = tx.objectStore(STORE_NAME);
				store.clear();
				records.forEach(function(record) { store.put(record); });
				tx.oncomplete = function() { resolve(); };
				tx.onerror = function() { reject(tx.error); };
			});
		});
	}

	function clearTempRecords() {
		return openDB().then(function(db) {
			return new Promise(function(resolve, reject) {
				var tx = db.transaction(STORE_NAME, 'readwrite');
				var store = tx.objectStore(STORE_NAME);
				store.clear();
				tx.oncomplete = function() { resolve(); };
				tx.onerror = function() { reject(tx.error); };
			});
		});
	}

	function getSf() {
		return TYRANO.kag.variable.sf;
	}

	function saveToDisk() {
		TYRANO.kag.saveSystemVariable();
	}

	function setNestedValue(obj, path, value) {
		var keys = path.split('.');
		var current = obj;
		for (var i = 0; i < keys.length - 1; i++) {
			var k = keys[i];
			if (current[k] === undefined || current[k] === null || typeof current[k] !== 'object') {
				current[k] = {};
			}
			current = current[k];
		}
		current[keys[keys.length - 1]] = value;
	}

	function getNestedValue(obj, path) {
		var keys = path.split('.');
		var current = obj;
		for (var i = 0; i < keys.length; i++) {
			if (current === undefined || current === null) return undefined;
			current = current[keys[i]];
		}
		return current;
	}

	function deleteNestedValue(obj, path) {
		var keys = path.split('.');
		var current = obj;
		for (var i = 0; i < keys.length - 1; i++) {
			if (current === undefined || current === null || typeof current[keys[i]] !== 'object') return;
			current = current[keys[i]];
		}
		delete current[keys[keys.length - 1]];
	}

	function revertTempRecords(records) {
		var sf = getSf();
		records.forEach(function(record) {
			try {
				if (record.diffType === 'array_elements') {
					var current = getNestedValue(sf, record.key);
					if (Array.isArray(current) && Array.isArray(record.addedElements)) {
						var toRemove = record.addedElements;
						var cleaned = current.filter(function(item) {
							var idx = -1;
							for (var i = 0; i < toRemove.length; i++) {
								if (JSON.stringify(toRemove[i]) === JSON.stringify(item)) {
									idx = i;
									break;
								}
							}
							if (idx !== -1) {
								toRemove = toRemove.slice(0, idx).concat(toRemove.slice(idx + 1));
								return false;
							}
							return true;
						});
						setNestedValue(sf, record.key, cleaned);
					}
				} else if (record.diffType === 'object_keys') {
					var currentObj = getNestedValue(sf, record.key);
					if (currentObj && typeof currentObj === 'object' && Array.isArray(record.addedKeys)) {
						record.addedKeys.forEach(function(k) {
							delete currentObj[k];
						});
					}
				} else if (record.hadPrevious) {
					setNestedValue(sf, record.key, record.previousValue);
				} else {
					deleteNestedValue(sf, record.key);
				}
			} catch (error) {
				runtime.logError('回滚临时变量失败: ' + record.key, error);
			}
		});
	}

	function applyPatch(patch) {
		var sf = getSf();
		var key = patch.key;
		var value = patch.value;

		if (typeof value === 'function') {
			var current = getNestedValue(sf, key);
			value = value(current, sf);
		}

		var previousValue = getNestedValue(sf, key);
		var hadPrevious = previousValue !== undefined;

		var record = {
			key: key,
			previousValue: hadPrevious ? previousValue : undefined,
			hadPrevious: hadPrevious,
			newValue: value
		};

		if (hadPrevious && Array.isArray(previousValue) && Array.isArray(value)) {
			var prevSet = previousValue.map(function(v) { return JSON.stringify(v); });
			var addedElements = value.filter(function(v) {
				var s = JSON.stringify(v);
				var idx = prevSet.indexOf(s);
				if (idx !== -1) {
					prevSet.splice(idx, 1);
					return false;
				}
				return true;
			});
			record.diffType = 'array_elements';
			record.addedElements = addedElements;
		} else if (hadPrevious && previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue)
				&& value && typeof value === 'object' && !Array.isArray(value)) {
			var addedKeys = Object.keys(value).filter(function(k) {
				return !(k in previousValue);
			});
			if (addedKeys.length > 0 && addedKeys.length < Object.keys(value).length) {
				record.diffType = 'object_keys';
				record.addedKeys = addedKeys;
			}
		}

		setNestedValue(sf, key, value);

		return record;
	}

	function applyAllPatches() {
		var records = [];

		state.directPatches.forEach(function(patch) {
			try {
				applyPatch(patch);
				if (runtime.settings.debug) {
					runtime.logSuccess('直接修改: sf.' + patch.key);
				}
			} catch (error) {
				runtime.logError('直接修改失败: sf.' + patch.key, error);
			}
		});

		state.tempPatches.forEach(function(patch) {
			try {
				var record = applyPatch(patch);
				records.push(record);
				if (runtime.settings.debug) {
					runtime.logSuccess('临时修改: sf.' + patch.key);
				}
			} catch (error) {
				runtime.logError('临时修改失败: sf.' + patch.key, error);
			}
		});

		saveToDisk();

		if (records.length > 0) {
			saveTempRecords(records).catch(function(error) {
				runtime.logError('保存临时修改记录到 IndexedDB 失败', error);
			});
		}

		state.applied = true;
	}

	function initModule() {
		loadTempRecords().then(function(oldRecords) {
			if (oldRecords.length > 0) {
				runtime.logSuccess('回滚 ' + oldRecords.length + ' 条旧临时修改');
				revertTempRecords(oldRecords);
				saveToDisk();
			}
			return clearTempRecords();
		}).then(function() {
			applyAllPatches();
		}).catch(function(error) {
			runtime.logError('初始化流程异常，尝试直接应用修改', error);
			applyAllPatches();
		});
	}

	function checkReady() {
		try {
			return (
				typeof TYRANO !== 'undefined' &&
				TYRANO.kag &&
				TYRANO.kag.variable &&
				TYRANO.kag.variable.sf &&
				typeof TYRANO.kag.saveSystemVariable === 'function'
			);
		} catch (error) {
			return false;
		}
	}

	function validatePatch(patch) {
		if (!patch || typeof patch !== 'object') return false;
		if (!patch.key || typeof patch.key !== 'string') return false;
		if (patch.value === undefined && typeof patch.value !== 'function') return false;
		return true;
	}

	var moduleApi = helper.ensurePath(modloader.api, 'sysvar');

	moduleApi.register = function(list) {
		if (!Array.isArray(list)) {
			runtime.logError('注册失败: 必须传入数组');
			return null;
		}

		var registered = [];
		list.forEach(function(patch) {
			try {
				if (!validatePatch(patch)) {
					runtime.logError('注册失败: 无效的修改项', patch);
					return;
				}
				var type = patch.type === 'temp' ? 'temp' : 'direct';
				var entry = { key: patch.key, value: patch.value, type: type };

				if (type === 'temp') {
					state.tempPatches.push(entry);
				} else {
					state.directPatches.push(entry);
				}

				registered.push(entry);
				if (runtime.settings.debug) {
					runtime.logRegisterSuccess(
						'sf.' + patch.key,
						['类型: [' + (type === 'temp' ? '临时修改' : '直接修改') + ']']
					);
				}
			} catch (error) {
				runtime.logError('注册异常: sf.' + (patch.key || '?'), error);
			}
		});

		if (state.applied && registered.length > 0 && checkReady()) {
			var hotTempRecords = [];
			registered.forEach(function(entry) {
				try {
					var record = applyPatch(entry);
					if (entry.type === 'temp') {
						hotTempRecords.push(record);
					}
				} catch (error) {
					runtime.logError('热应用失败: sf.' + entry.key, error);
				}
			});
			saveToDisk();

			if (hotTempRecords.length > 0) {
				loadTempRecords().then(function(existing) {
					var merged = existing.concat(hotTempRecords);
					return saveTempRecords(merged);
				}).catch(function(error) {
					runtime.logError('更新 IndexedDB 临时记录失败', error);
				});
			}
		}

		return registered.length > 0 ? registered : null;
	};

	moduleApi.show = function() {
		if (!checkReady()) {
			runtime.logError('显示失败: 引擎未就绪');
			return null;
		}
		return {
			sf: getSf(),
			directPatches: state.directPatches.map(function(p) {
				return { key: p.key, currentValue: getNestedValue(getSf(), p.key) };
			}),
			tempPatches: state.tempPatches.map(function(p) {
				return { key: p.key, currentValue: getNestedValue(getSf(), p.key) };
			}),
			applied: state.applied
		};
	};

	runtime.initialize(checkReady, initModule);
})();
