(function () {
    var ko = require('knockout');

    var CommandRunner = function(commands) {
        var self = this;
        this.current = ko.observable(0);
        this.running = ko.observable(false);
        this.commands = commands;
        this.success = ko.computed(function () {
            return (self.current() === self.commands.length);
        });
        this.process = null;
    };

    CommandRunner.prototype = {
        constructor: CommandRunner,

        start: function () {
            this.running(true);
            this.current(0);
            this.next();
        },

        end: function (noKill) {
            if (this.process && !noKill) {
                this.process.kill();
            }
            this.process = null;
            this.running(false);
        },

        next: function () {
            var self = this;
            var current = this.current();
            var command = this.commands[current];
            if (current === this.commands.length) {
                this.end(true);
                return;
            } else {
                console.log(current, command.description + '...');
                command.run(function() {
                    if (command.error()) {
                        self.end(true);
                    } else {
                        self.current(current+1);
                        self.next();
                    }
                });
            }
        }
    };

    module.exports = CommandRunner;
})();
