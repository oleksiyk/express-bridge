"use strict";

var dox     = require('dox');
// var path = require('path');
var fs      = require('fs');
var Promise = require('bluebird');
var _       = require('lodash');

module.exports.parse = function (file) {

    return Promise.promisify(fs.readFile)(file, { encoding: 'utf8'})
        .then(function (data) {
            return dox.parseComments(data, { raw: true })
        })
        .then(function (parsed) {

            var module = _.find(parsed, function (value) {
                return _.find(value.tags, { type: 'module'});
            });

            var methods = _(parsed).filter(function (value, key, collection) {

                // check for required tags
                if(value.tags){
                    // parse apiRoute
                    var apiRoute = _.find(value.tags, { type: 'apiRoute'});
                    if(!apiRoute) {return false;}
                    collection[key].apiRoute = /^[ \t]*(post|get)[ \t]*(.+)$/i.exec(apiRoute.string);
                    if(!collection[key].apiRoute) {return false;}

                    // parse apiReturns
                    var apiReturns = _.find(value.tags, { type: 'apiReturns'});
                    if(!apiReturns) {return false;}
                    collection[key].apiReturns = /^[ \t]*\{(.+?)\}[ \t]*(.*)$/i.exec(apiReturns.string);
                    if(!collection[key].apiReturns) {return false;}

                    return true;
                }
                return false;
            }).map(function (method) {

                    return {
                        name: method.ctx.name,
                        description: method.description.full,
                        params: _(method.tags).filter({type: 'param'}).map(function (value) {

                            var p = _.omit(value, 'type');

                            // set param type (uri, query or body)
                            var r = new RegExp('\\W:' + p.name + '(\\W|$)');
                            if(r.exec(method.apiRoute[2])){
                                p.type = 'uri'
                            } else if(method.apiRoute[1].toLowerCase() == 'post'){
                                p.type = 'body';
                            } else if(method.apiRoute[1].toLowerCase() == 'get'){
                                p.type = 'query';
                            }

                            // parse optional params
                            if(/\[(\w+)\]/.exec(p.name)){
                                p.name = RegExp.$1;
                                p.optional = true;
                            }

                            // local params map to request properties, like _user => req.user
                            // these must be hidden from remote API
                            if(/_(\w+)/.exec(p.name)){
                                p.name = RegExp.$1;
                                p.type = 'local';
                            }

                            return p;

                        }).value(),
                        method: method.apiRoute[1].toLowerCase(),
                        route: method.apiRoute[2],
                        returns: {
                            type: method.apiReturns[1],
                            description: method.apiReturns[2]
                        }
                    }

                }).value();

            return {
                name: _.find(module.tags, { type: 'module'}).string,
                description: module.description.full,
                methods: methods
            };
        })
}
