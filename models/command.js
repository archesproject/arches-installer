(function () {
    var Backbone = require('backbone');
    var ko = require('knockout');
    var sudoExec = require('electron-sudo').exec;
    var sudo = {
        exec: function(cmd, callback) {
            var options = {
                name: 'Arches Installer',
                icns: './assets/img/arches_logo.icns'
            };
            sudoExec(cmd, options, callback);
        }
    };
    var cp = require('child_process');

    module.exports = Backbone.Model.extend({
        initialize: function (options) {
            var self = this;
            this.complete = ko.observable(false);
            this.success = ko.observable();
            this.error = ko.observable();
            this.stdout = ko.observable();
            this.stderr = ko.observable();
            this.process = null;

            this.command = options.command ? options.command : '';
            this.description = options.description ? options.description : '';
            this.sudo = options.sudo ? options.sudo : false;

            this.getCommand = options.getCommand ? options.getCommand : function () {
                return self.command;
            };
        },
        run: function (callback) {
            var self = this;
            var p = this.sudo ? sudo : cp;
            this.process = p.exec(this.getCommand(), function(error, stdout, stderr) {
                self.error(error);
                self.stdout(stdout);
                self.stderr(stderr);
                callback(self);
            });
            return this.process;
        }
    });
})();
