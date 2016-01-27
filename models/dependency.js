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
            this.name = options.name ? options.name : '';

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
        }
    });
})();
