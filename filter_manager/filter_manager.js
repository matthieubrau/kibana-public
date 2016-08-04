// Adds a filter to a passed state
define(function (require) {
  return function (Private) {
    var _ = require('lodash');
    var queryFilter = Private(require('ui/filter_bar/query_filter'));
    var filterManager = {};

    filterManager.removeOperatorFilter = function(filter){
      queryFilter.removeFilter(filter)
    }

    filterManager.getAll = function () {
      return _.flatten([queryFilter.getAppFilters()]);
    }

    filterManager.filterAlreadyExist = function(field){
      var filters = _.flatten([queryFilter.getAppFilters()]);
      for (i = 0; i<filters.length; i++){
        if ( filters[i].meta.field_name == field || filters[i].meta.value.indexOf(field) > -1 ){
          return filters[i]
        }
      }
      return false
    }

    filterManager.addOrFilter = function (field, values, match_field){
      if (typeof(match_field) == "undefined"){
        match_field = field
      }
      var filters = _.flatten([queryFilter.getAppFilters()]);
      for (i = 0; i<filters.length; i++){
        if ( ( field == "localisation" && ( match_field == "department_code" || match_field == "region_name" || match_field == "natural_region_id" || match_field == "city_name") ) || filters[i].meta.field_name == field || filters[i].meta.value.indexOf(field) > -1){
          if ( filters[i].query ){
            filters[i].bool = {should: []}
            if ( values != filters[i].meta.value){
              newShould = {"query": {"match": {}}}
              newShould.query.match[match_field] = {"query": values,"type": "phrase"}
              filters[i].bool.should.push(newShould)
              newShould = {"query": {"match": {}}}
              newShould.query.match[filters[i].meta.field_name] = {"query": filters[i].meta.value,"type": "phrase"}
              filters[i].bool.should.push(newShould)
              delete filters[i].query
            }
          }else if ( filters[i].bool ){
            newShould = {"query": {"match": {}}}
            newShould.query.match[match_field] = {"query": values,"type": "phrase"}
            exist = false
            for (j = 0; j < filters[i].bool.should.length; j++){
              if ( queryFilter.getQuery(filters[i].bool.should[j]) == values){
                exist = true
                break;
              }
            }
            if ( exist == false ){
              filters[i].bool.should.push(newShould)
            }
          }
          console.log(filters[i])
        }
      }
    }

    filterManager.addOperatorFilter = function (field, values, operator, first_op){
      var filters = _.flatten([queryFilter.getAppFilters()]);
      for (i = 0; i<filters.length; i++){
        if ( filters[i].meta.field_name == field || filters[i].meta.value.indexOf(field) > -1){
          if ( filters[i].query ){
            filters[i].bool = {}
            filters[i].bool[first_op] = []
            newItem = {"query": {"match": {}}}
            newItem.query.match[field] = {"query": filters[i].meta.value,"type": "phrase"}
            filters[i].bool[first_op].push(newItem)
            delete filters[i].query
          }
          if (typeof(filters[i].bool[operator]) == "undefined"){
            filters[i].bool[operator] = []
          }
          newItem = {"query": {"match": {}}}
          newItem.query.match[field] = {"query": values,"type": "phrase"}
          filters[i].bool[operator].push(newItem)
        }
      }
    }

    filterManager.add = function (field, values, operation, index) {
      values = _.isArray(values) ? values : [values];
      var fieldName = _.isObject(field) ? field.name : field;
      var filters = _.flatten([queryFilter.getAppFilters()]);
      var newFilters = [];

      var negate = (operation === '-');

      // TODO: On array fields, negating does not negate the combination, rather all terms
      _.each(values, function (value) {
        var filter;
        var existing = _.find(filters, function (filter) {
          if (!filter) return;

          if (fieldName === '_exists_' && filter.exists) {
            return filter.exists.field === value;
          }

          if (filter.query) {
            return filter.query.match[fieldName] && filter.query.match[fieldName].query === value;
          }

          if (filter.script) {
            return filter.meta.field === fieldName && filter.script.params.value === value;
          }
        });

        if (existing) {
          existing.meta.disabled = false;
          if (existing.meta.negate !== negate) {
            queryFilter.invertFilter(existing);
          }
          return;
        }

        switch (fieldName) {
          case '_exists_':
            filter = {
              meta: {
                negate: negate,
                index: index
              },
              exists: {
                field: value
              }
            };
            break;
          default:
            if (field.scripted) {
              filter = {
                meta: { negate: negate, index: index, field: fieldName },
                script: {
                  script: '(' + field.script + ') == value',
                  lang: field.lang,
                  params: {
                    value: value
                  }
                }
              };
            } else {
              filter = { meta: { negate: negate, index: index }, query: { match: {} } };
              filter.query.match[fieldName] = { query: value, type: 'phrase' };
            }

            break;
        }

        newFilters.push(filter);
      });

      return queryFilter.addFilters(newFilters);
    };

    return filterManager;
  };
});
