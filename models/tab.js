(function () {
    var Backbone = require('backbone');
    var ko = require('knockout');

    module.exports = Backbone.Model.extend({
        initialize: function (options) {
            var self = this;
            this.index = options.index ? options.index : 0;
            this.title = options.title ? options.title : 'Tab';
            this.description = options.description ? options.description : 'Tab description...';
            this.helpLink = options.helpLink ? options.helpLink : 'http://arches3.readthedocs.org/en/latest/getting-started/';
            this.tabLink = options.tabLink ? options.tabLink : '#';
            this.readyModel = options.readyModel ? options.readyModel : null;
            this.active = ko.observable(options.active ? options.active : false);

            this.getPrevious = options.getPrevious ? options.getPrevious : function () {
                return null;
            };

            this.activateTab = options.activateTab ? options.activateTab : function () {
                this.active(true);
            };

            this.ready = ko.computed(function () {
                if (self.readyModel) {
                    return self.readyModel.ready();
                }
                return true;
            });
            this.allowNext = ko.computed(function () {
                var allow = self.ready();
                var previous = self.getPrevious();
                if (previous && allow){
                    return previous.allowNext();
                }
                return allow;
            });
            this.enableTab = ko.computed(function () {
                var previous = self.getPrevious();
                if (previous) {
                    return previous.allowNext();
                }
                return true;
            })
        }
    });
})();
