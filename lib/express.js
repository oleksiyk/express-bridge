var express = require('express');
var fs = require('fs');
var Q = require('q');
var _ = require('lodash');
var parser = require('./parser');


/**
 * Configure and return Express-Bridge
 *
 * @param _options
 * @api public
 */
module.exports = function (options) {

    var expressApp = express();

    /**
     * Array of parsed controller info
     */
    var controllersInfo = [];

    /**
     * Map of loaded controller objects (api)
     */
    var api = {};

    var handlersMap = {};

    var parsedPromise = null;

    options = _.partialRight(_.merge, _.defaults)(options || {}, {
        errorStackTrace: true
    });

    /**
     * Process each file
     * @param file
     * @param moduleArguments
     * @returns {*}
     *
     * @api private
     * @ignore
     */
    var processFile = function (file, moduleArguments) {

        return parser.parse(file).then(function (controllerInfo) {

            controllersInfo.push(controllerInfo);

            api[controllerInfo.name] = require(file);

            if (typeof api[controllerInfo.name] === 'function') {
                api[controllerInfo.name] = api[controllerInfo.name].apply(null, moduleArguments);
            }

            controllerInfo.methods.forEach(function (m) {

                var handler = function (req, res) {

                    var apiParams = m.params.map(function (p) {
                        switch (p.type) {
                            case 'body':
                                return req.body[p.name];
                            case 'query':
                                return req.query[p.name];
                            case 'uri':
                                return req.params[p.name];
                            case 'local':
                                return req[p.name];
                        }
                    })

                    Q.fapply(api[controllerInfo.name][m.name], apiParams)
                        .then(function (result) {
                            switch (m.returns.type) {
                                case 'Object':
                                case 'Array':
                                    res.json(result);
                                    break;
                                case 'String':
                                default:
                                    res.send(result)
                            }

                        })
                        .fail(function (error) {

                            console.error(error.stack);

                            if (error.code) {
                                res.status(error.code).json(error)
                            } else {
                                res.status(500).json({error: error.toString(), stackTrace: error.stack})
                            }

                        })

                };

                add(controllerInfo.name + '.' + m.name, handler);

            })
        })
    }

    /**
     * Add additional request handler
     *
     * @param {String} [path] API Path in dotted notation, e.g. ModuleName.MethodName, ModuleName or just ''
     * @param {Array|Function} handlers Express-style request middleware ( function(req, res, next) {} )
     *
     * @type {Function}
     * @api public
     */
    var add = function (path, handlers) {

        var args = Array.prototype.slice.call(arguments);

        if (_.isFunction(path)) {
            path = '';
            handlers = args;

        } else if (_.isArray(path)) {
            path = '';
            handlers = args[0];
        } else if (arguments.length > 2) {
            handlers = args.slice(1)
        }

        if (!_.isArray(handlers)) {
            handlers = [handlers];
        }

        var phase = parsedPromise ? 'post' : 'pre';

        if (!handlersMap[path]) {
            handlersMap[path] = [];
        }

        handlersMap[path] = handlersMap[path].concat(handlers);
    }

    /**
     * Return Express-Bridge object
     */
    return {

        /**
         * Load file(s)
         *
         * @param files
         * @returns {Promise|All}
         * @api public
         */
        include: function (files) {

            var moduleArguments = Array.prototype.slice.call(arguments, 1);

            if (!_.isArray(files)) {
                files = [files];
            }

            return parsedPromise = Q.all(files.map(function (file) {

                if (!fs.existsSync(file)) {
                    file = file + '.js';
                    if (!fs.existsSync(file)) {
                        return; // ignore missing files
                    }
                }

                return processFile(file, moduleArguments);

            }))
        },

        /**
         * Map of API controllers
         *
         * Example: expressbridge.api().moduleName.methodName(arg1, arg2, ..)
         *
         * @returns {Object}
         * @api public
         */
        api: function () {
            return api;
        },

        add: add,

        /**
         * Return Express application
         *
         * In your application: app.use(expressBridge.app())
         *
         * @returns {Object} Express
         * @api public
         */
        app: function () {

            if (!parsedPromise) {
                throw new Error('No files were added to ExpressBridge')
            }

            parsedPromise.then(function () {
                controllersInfo.forEach(function (controller) {

                    controller.methods.forEach(function (method) {

                        var handlers = [].concat(
                            handlersMap[''] || [],
                            handlersMap[controller.name] || [],
                            handlersMap[controller.name + '.' + method.name]
                        );

                        expressApp[method.method].call(expressApp, method.route, handlers);

                    })
                })
            })

            return expressApp;
        }

    }

}




