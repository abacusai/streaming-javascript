(function() {

    var WRITE_METHODS = {
        upsert: 'upsertData',
        user: 'upsertData',
        record: 'appendData',
        append: 'appendData',
        upsertMultiple: 'upsertMultipleData',
        appendMultiple: 'appendMultipleData'
    }

    var PREDICT_METHOD = 'predict';

    var ENDPOINT;
    var AUTH_PARAM;
    var userId;
    var DEPLOYMENT_ID;
    var DEPLOYMENT_AUTH_PARAM;
    var FEATURE_GROUPS;

    var timerReCall = null;
    var interactionBuffer = [];
    var currentTimestamp = -1;

    var PREDICTION_USER_KEY = 'userId';
    var USER_KEY = 'userId';
    var TIMESTAMP_KEY = 'timestamp';

    function initAbacusaiCookieUser(newUserAttributes) {
        let userCookie = document.cookie.split(';').find(function(entry) {
            return entry.trim().startsWith('abacusAiUserId=');
        });
        if (userCookie) {
            userId = userCookie.split('=')[1].trim();
        } else {
            userId = 'abacusai/' + ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                let r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }))
            document.cookie = `abacusAiUserId=${userId}; path="/"; max-age=86400`
            if ('user' in FEATURE_GROUPS && FEATURE_GROUPS['user']) {
                interactionBuffer.push({
                    method: 'user',
                    featureGroupId: FEATURE_GROUPS.user,
                    data: {
                        [USER_KEY]: userId,
                        '_timezone': (new Date()).getTimezoneOffset(),
                        '_referrer': document.referrer,
                        '_useragent': navigator.userAgent,
                        '_screendim': window.screen.width + "x" + window.screen.height,
                        ...newUserAttributes
                    }
                });

                if (timerReCall == null) {
                    timerReCall = setTimeout(flushInteractions, 10);
                }
            }

        }
    }

    function methodUrl(method, featureGroupId) {
        return `${ENDPOINT}/${method}?${AUTH_PARAM}&featureGroupId=${featureGroupId}`;
    }

    function predictionUrl() {
        return `${ENDPOINT}/predict?${DEPLOYMENT_AUTH_PARAM}&deploymentId=${DEPLOYMENT_ID}`;
    }

    function reaitag(command, params, callback = () => {}) {
        if (command === 'init') {
            if (!params) {
                console.warn('Missing required init params.')
                return
            }
            let subdomain = (params.workspace || '').replace(/[^a-zA-Z0-9.]/g, '') || 'api';
            ENDPOINT = `https://${subdomain}.abacus.ai/api`
            AUTH_PARAM = 'streamingToken=' + params.streamingToken;
            FEATURE_GROUPS = params.featureGroups || {}
            DEPLOYMENT_ID = params.deploymentId || null;
            DEPLOYMENT_AUTH_PARAM = 'deploymentToken=' + params.deploymentToken;
            PREDICTION_USER_KEY = params.userKey || PREDICTION_USER_KEY;
            USER_KEY = params.userKey || USER_KEY;
            if (params.hasOwnProperty(USER_KEY) && params[USER_KEY]) {
                userId = params[USER_KEY];
            } else {
                if (params.hasOwnProperty(USER_KEY)) {
                    console.error('Invalid value for userId field, using cookie instead.')
                }
                initAbacusaiCookieUser(params.newUserAttributes)
            }
            callback(userId);
            return userId;
        }

        if (command === 'setUser') {
            if (params) {
                userId = params;
            }
            return;
        }

        if (command === 'getUser') {
            callback(userId);
            return userId;
        }

        if (command in WRITE_METHODS) {
            if (!params) {
                console.log('Missing streaming data');
                return;
            }
            if (!FEATURE_GROUPS || !FEATURE_GROUPS.hasOwnProperty(command)) {
                console.warn('No feature group configured for method ' + command);
                return;
            }

            let update = Object.assign({}, params);

            if (!params.hasOwnProperty(TIMESTAMP_KEY)) {
                currentTimestamp = Math.max(currentTimestamp + 1, Date.now())
                update[TIMESTAMP_KEY] = currentTimestamp;
            }

            if (!params.hasOwnProperty(USER_KEY)) {
                update[USER_KEY] = userId;
            }

            interactionBuffer.push({
                method: WRITE_METHODS[command],
                featureGroupId: FEATURE_GROUPS[command],
                data: update
            });

            if (timerReCall == null) {
                timerReCall = setTimeout(flushInteractions, 10);
            }

            return;
        }
        if (command == PREDICT_METHOD) {
            if (!params) {
                params = { data: {} };
            } else if (params.data == null) {
                params.data = {};
            }
            if (PREDICTION_USER_KEY && (!params.data || !params.data.hasOwnProperty(PREDICTION_USER_KEY))) {
                params.data[PREDICTION_USER_KEY] = userId;
            }
            flushInteractions();
            params.reaiRetryNum = 0;

            postPrediction(params, callback);
            return;
        }

        console.error('Unrecognized reaitag command ' + command)
    }

    function flushInteractions() {
        timerReCall = null;

        if (interactionBuffer.length === 0) {
            return;
        }

        let params = {
            event: interactionBuffer.shift(),
            reaiRetryNum: 0
        }
        postInteractions(params);

        if (interactionBuffer.length > 0) {
            timerReCall = setTimeout(flushInteractions, 200);
        }
    }

    function postInteractions(params) {
        var request = new XMLHttpRequest();
        request.open('POST', methodUrl(params.event.method, params.event.featureGroupId), true);
        request.onload = function() {
            if (request.status >= 500 && params.reaiRetryNum < 3) {
                console.warn('Error recording interactions: ' + request.status);
                params.reaiRetryNum += 1;
                setTimeout(function() { postInteractions(params) }, params.reaiRetryNum * 5 * 1000);
            }
        };

        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify({'data': params.event.data}));
    }

    function postPrediction(params, callback) {
        var request = new XMLHttpRequest();
        request.open('POST', predictionUrl(), true);
        request.onload = function() {
            if (request.status == 200) {
                callback(JSON.parse(request.response).result, null);
            } else if (request.status >= 500 && params.reaiRetryNum < 3) {
                console.warn('Prediction recording interactions: ' + request.status);
                params.reaiRetryNum += 1;
                setTimeout(function() { postPrediction(params, callback) }, params.reaiRetryNum * 5 * 1000);
            } else if (request.status >= 400) {
                callback(null, JSON.parse(request.response).error);
            } else {
                callback(null, 'Error making prediction call: ' + request.status)
            }
        };

        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify({ "queryData": params.data, ...params.options }));
    }


    window.reaitag = reaitag;

    if (window.reDataList) {
        let list = window.reDataList.slice(0);
        window.reDataList = [];

        list.forEach(function(item) {
            reaitag.apply(this, item);
        });
    }
})();
