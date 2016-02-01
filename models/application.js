(function () {
    var Backbone = require('backbone');
    var ko = require('knockout');

    module.exports = Backbone.Model.extend({
        initialize: function (options) {
            this.name = options.name ? options.name : '';
            this.module = options.module ? options.module : '';
            this.hasDefaultAuthFiles = options.hasDefaultAuthFiles ? options.hasDefaultAuthFiles : '';
            this.caption = options.caption ? options.caption : '';
            this.description = options.description ? options.description : '';
            this.image = options.image ? options.image : '';
            this.installer = options.installer ? options.installer : null;
        }
    });
})();
