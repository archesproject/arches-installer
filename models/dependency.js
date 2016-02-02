(function () {
    var Backbone = require('backbone');
    var ko = require('knockout');

    module.exports = Backbone.Model.extend({
        initialize: function (options) {
            var exec = require('child_process').exec;
            var self = this;
            this.ready = ko.observable(false);
            this.running = ko.observable(false);
            this.checked = ko.observable(false);
            this.parseVersion = options.parseVersion ? options.parseVersion : function (stdout, stderr) {
                return (stdout+stderr!=='');
            };
            this.versionCmd = options.versionCmd ? options.versionCmd : '';
            this.name = ko.observable(options.name ? options.name : '');
            this.version = ko.observable('');
            this.statusText = ko.observable('');
            this.helpURL = ko.observable(options.helpURL ? options.helpURL : '');

            this.check = function (callback) {
                self.ready(false);
                self.running(true);
                var child = exec(self.versionCmd, function (error, stdout, stderr) {
                    self.running(false);
                    self.checked(true);
                    self.ready(self.parseVersion(stdout, stderr));
                    if (callback) {
                        callback();
                    }
                });
            };
        },
        versionCompare: function(v1, v2, options) {
            var lexicographical = options && options.lexicographical,
                zeroExtend = options && options.zeroExtend,
                v1parts = v1.replace('_','.').trim().split('.'),
                v2parts = v2.replace('_','.').trim().split('.');

            function isValidPart(x) {
                return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
            }

            if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
                return NaN;
            }

            if (zeroExtend) {
                while (v1parts.length < v2parts.length) v1parts.push("0");
                while (v2parts.length < v1parts.length) v2parts.push("0");
            }

            if (!lexicographical) {
                v1parts = v1parts.map(Number);
                v2parts = v2parts.map(Number);
            }

            for (var i = 0; i < v1parts.length; ++i) {
                if (v2parts.length == i) {
                    return 1;
                }

                if (v1parts[i] == v2parts[i]) {
                    continue;
                }
                else if (v1parts[i] > v2parts[i]) {
                    return 1;
                }
                else {
                    return -1;
                }
            }

            if (v1parts.length != v2parts.length) {
                return -1;
            }

            return 0;
        }
    });
})();
