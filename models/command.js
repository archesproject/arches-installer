(function () {
    var Backbone = require('backbone');
    var ko = require('knockout');
    var sudoExec = require('electron-sudo').exec;
    var sudo = {
        exec: function(cmd, options, callback) {
            sudoExec(cmd, {
                name: 'Arches Installer',
                icns: './assets/img/arches_logo.icns',
                options: options
            }, callback);
        }
    };
    var cp = require('child_process');

    module.exports = Backbone.Model.extend({
        initialize: function (options) {
            var self = this;
            this.complete = ko.observable(false);
            this.running = ko.observable(false);
            this.success = ko.observable();
            this.error = ko.observable();
            this.stdout = ko.observable();
            this.stderr = ko.observable();
            this.process = null;

            this.command = options.command ? options.command : '';
            this.description = options.description ? options.description : '';
            this.sudo = options.sudo ? options.sudo : false;
            this.postExec = options.postExec ? options.postExec : function (error, stdout, stderr, callback) {
                self.running(false);
                self.complete(true);
                self.success(!error);
                callback(self);
            };

            this.getCommand = options.getCommand ? options.getCommand : function () {
                return self.command;
            };
        },
        run: function (callback) {
            var self = this;
            var p = this.sudo ? sudo : cp;
            this.running(true);
            this.process = p.exec(this.getCommand(), {maxBuffer: 1024 * 500}, function(error, stdout, stderr) {
                self.error(error);
                self.stdout(stdout);
                self.stderr(stderr);
                self.postExec(error, stdout, stderr, callback);
            });
            return this.process;
        }
    });
})();
