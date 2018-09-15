/// <reference path="../DB/tools.js" />

(function () {

    var lst2 = [1, 2, 3, 4, 5];
    _check(lst2._d().isContain(2) && !lst2._d().isContain(9), "isContain 1");
    _check(lst._d().isContain(111, function (item, val) {
        return item.a == val;
    }) && !lst._d().isContain(2000, function (item, val) {
        return item.a == val;
    }), "isContain 2");

    var removecheck = true;
    removecheck = removecheck && lst2._d().remove(2);
    removecheck = removecheck && !lst2._d().isContain(2);
    _check(removecheck, "remove 1");
    removecheck = true;
    removecheck = removecheck && !lst2._d().remove(9);
    _check(removecheck, "remove 2");
    removecheck = true;
    removecheck = removecheck && lst3._d().remove(111, function (item, val) {
        return item.a == val;
    });
    removecheck = removecheck && !lst3._d().isContain(111, function (item, val) {
        return item.a == val;
    });
    _check(removecheck, "remove 3");
    removecheck = true;
    removecheck = removecheck && !lst3._d().remove(2000, function (item, val) {
        return item.a == val;
    });
    _check(removecheck, "remove 4");

    var filtercheck = true;
    var k = 0;
    var lst4 = lst3._d().filter(function (item, i) {
        filtercheck = filtercheck && item == this;
        filtercheck = filtercheck && i == k++;
        return item.a >= 50 && item.a < 100;
    });
    filtercheck = filtercheck && lst4.length == 50;
    for (var i = 0; i < lst4.length; i++) {
        filtercheck = filtercheck && lst4[i].a >= 50 && lst4[i].a < 100;
    }
    _check(filtercheck, "filter");
})();