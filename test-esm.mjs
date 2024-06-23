import polybool from './dist/polybool.js';
console.log(polybool.intersect({
  regions: [
    [[50,50], [150,150], [190,50]],
    [[130,50], [290,150], [290,50]]
  ],
  inverted: false
}, {
  regions: [
    [[110,20], [110,110], [20,20]],
    [[130,170], [130,20], [260,20], [260,170]]
  ],
  inverted: false
}));
