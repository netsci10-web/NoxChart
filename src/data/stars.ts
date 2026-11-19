import { Star } from '../types/astronomy';

const ra = (h: number, m: number, s = 0) => (h + m / 60 + s / 3600) * 15;
const dec = (deg: number, m: number, s = 0) => {
  const sign = deg < 0 || Object.is(deg, -0) ? -1 : 1;
  return sign * (Math.abs(deg) + m / 60 + s / 3600);
};

// Real J2000 Bright & Navigation Star Catalog (Hipparcos / Yale Bright Star precision)
export const BRIGHT_STARS: Star[] = [
  // Brightest 1st & 2nd magnitude + key constellation anchors across the entire celestial sphere
  { id: 'Sirius', hip: 32349, ra: ra(6, 45, 8.9), dec: dec(-16, 42, 58), mag: -1.46, bv: 0.00, name: 'Sirius', koName: '시리우스', bayer: 'α CMa', con: 'CMa' },
  { id: 'Canopus', hip: 30438, ra: ra(6, 23, 57.1), dec: dec(-52, 41, 44), mag: -0.74, bv: 0.15, name: 'Canopus', koName: '카노푸스', bayer: 'α Car', con: 'Car' },
  { id: 'Rigil Kentaurus', hip: 71683, ra: ra(14, 39, 36.5), dec: dec(-60, 50, 2), mag: -0.01, bv: 0.71, name: 'Rigil Kentaurus', koName: '리길 켄타우루스', bayer: 'α Cen', con: 'Cen' },
  { id: 'Arcturus', hip: 69673, ra: ra(14, 15, 39.7), dec: dec(19, 10, 57), mag: -0.05, bv: 1.23, name: 'Arcturus', koName: '아크투루스', bayer: 'α Boo', con: 'Boo' },
  { id: 'Vega', hip: 91262, ra: ra(18, 36, 56.3), dec: dec(38, 47, 1), mag: 0.03, bv: 0.00, name: 'Vega', koName: '베가 (직녀성)', bayer: 'α Lyr', con: 'Lyr' },
  { id: 'Capella', hip: 24608, ra: ra(5, 16, 41.4), dec: dec(45, 59, 53), mag: 0.08, bv: 0.80, name: 'Capella', koName: '카펠라', bayer: 'α Aur', con: 'Aur' },
  { id: 'Rigel', hip: 24436, ra: ra(5, 14, 32.3), dec: dec(-8, 12, 6), mag: 0.13, bv: -0.03, name: 'Rigel', koName: '리겔', bayer: 'β Ori', con: 'Ori' },
  { id: 'Procyon', hip: 37279, ra: ra(7, 39, 18.1), dec: dec(5, 13, 30), mag: 0.34, bv: 0.42, name: 'Procyon', koName: '프로키온', bayer: 'α CMi', con: 'CMi' },
  { id: 'Achernar', hip: 7588, ra: ra(1, 37, 42.8), dec: dec(-57, 14, 12), mag: 0.46, bv: -0.16, name: 'Achernar', koName: '아케르나르', bayer: 'α Eri', con: 'Eri' },
  { id: 'Betelgeuse', hip: 27989, ra: ra(5, 55, 10.3), dec: dec(7, 24, 25), mag: 0.50, bv: 1.85, name: 'Betelgeuse', koName: '베텔게우스', bayer: 'α Ori', con: 'Ori' },
  { id: 'Hadar', hip: 68702, ra: ra(14, 3, 49.4), dec: dec(-60, 22, 23), mag: 0.61, bv: -0.23, name: 'Hadar', koName: '하다르', bayer: 'β Cen', con: 'Cen' },
  { id: 'Altair', hip: 97649, ra: ra(19, 50, 47.0), dec: dec(8, 52, 6), mag: 0.76, bv: 0.22, name: 'Altair', koName: '알타이르 (견우성)', bayer: 'α Aql', con: 'Aql' },
  { id: 'Acrux', hip: 60718, ra: ra(12, 26, 35.9), dec: dec(-63, 5, 57), mag: 0.77, bv: -0.24, name: 'Acrux', koName: '아크룩스', bayer: 'α Cru', con: 'Cru' },
  { id: 'Aldebaran', hip: 21421, ra: ra(4, 35, 55.2), dec: dec(16, 30, 33), mag: 0.86, bv: 1.54, name: 'Aldebaran', koName: '알데바란', bayer: 'α Tau', con: 'Tau' },
  { id: 'Spica', hip: 65474, ra: ra(13, 25, 11.6), dec: dec(-11, 9, 41), mag: 0.97, bv: -0.23, name: 'Spica', koName: '스피카', bayer: 'α Vir', con: 'Vir' },
  { id: 'Antares', hip: 80763, ra: ra(16, 29, 24.5), dec: dec(-26, 25, 55), mag: 0.96, bv: 1.83, name: 'Antares', koName: '안타레스', bayer: 'α Sco', con: 'Sco' },
  { id: 'Pollux', hip: 37826, ra: ra(7, 45, 18.9), dec: dec(28, 1, 34), mag: 1.14, bv: 1.00, name: 'Pollux', koName: '폴룩스', bayer: 'β Gem', con: 'Gem' },
  { id: 'Fomalhaut', hip: 113368, ra: ra(22, 57, 39.0), dec: dec(-29, 37, 20), mag: 1.16, bv: 0.09, name: 'Fomalhaut', koName: '포말하우트', bayer: 'α PsA', con: 'PsA' },
  { id: 'Deneb', hip: 102098, ra: ra(20, 41, 25.9), dec: dec(45, 16, 49), mag: 1.25, bv: 0.09, name: 'Deneb', koName: '데네브', bayer: 'α Cyg', con: 'Cyg' },
  { id: 'Mimosa', hip: 62434, ra: ra(12, 47, 43.3), dec: dec(-59, 41, 19), mag: 1.25, bv: -0.23, name: 'Mimosa', koName: '미모사', bayer: 'β Cru', con: 'Cru' },
  { id: 'Regulus', hip: 49669, ra: ra(10, 8, 22.3), dec: dec(11, 58, 2), mag: 1.35, bv: -0.11, name: 'Regulus', koName: '레굴루스', bayer: 'α Leo', con: 'Leo' },
  { id: 'Adhara', hip: 33579, ra: ra(6, 58, 37.5), dec: dec(-28, 58, 20), mag: 1.50, bv: -0.21, name: 'Adhara', koName: '아다라', bayer: 'ε CMa', con: 'CMa' },
  { id: 'Castor', hip: 36850, ra: ra(7, 34, 35.9), dec: dec(31, 53, 18), mag: 1.58, bv: 0.03, name: 'Castor', koName: '카스토르', bayer: 'α Gem', con: 'Gem' },
  { id: 'Gacrux', hip: 61084, ra: ra(12, 31, 9.9), dec: dec(-57, 6, 48), mag: 1.63, bv: 1.59, name: 'Gacrux', koName: '가크룩스', bayer: 'γ Cru', con: 'Cru' },
  { id: 'Shaula', hip: 85927, ra: ra(17, 33, 36.5), dec: dec(-37, 6, 14), mag: 1.63, bv: -0.22, name: 'Shaula', koName: '샤울라', bayer: 'λ Sco', con: 'Sco' },
  { id: 'Bellatrix', hip: 25336, ra: ra(5, 25, 7.9), dec: dec(6, 20, 59), mag: 1.64, bv: -0.22, name: 'Bellatrix', koName: '벨라트릭스', bayer: 'γ Ori', con: 'Ori' },
  { id: 'Elnath', hip: 25428, ra: ra(5, 26, 17.5), dec: dec(28, 36, 27), mag: 1.65, bv: -0.13, name: 'Elnath', koName: '엘나트', bayer: 'β Tau', con: 'Tau' },
  { id: 'Miaplacidus', hip: 45238, ra: ra(9, 13, 12.0), dec: dec(-69, 43, 2), mag: 1.68, bv: 0.00, name: 'Miaplacidus', koName: '미아플라시두스', bayer: 'β Car', con: 'Car' },
  { id: 'Alnilam', hip: 26311, ra: ra(5, 36, 12.8), dec: dec(-1, 12, 7), mag: 1.69, bv: -0.18, name: 'Alnilam', koName: '알닐람', bayer: 'ε Ori', con: 'Ori' },
  { id: 'Alnair', hip: 109268, ra: ra(22, 8, 14.0), dec: dec(-46, 57, 40), mag: 1.74, bv: -0.13, name: 'Alnair', koName: '알나이르', bayer: 'α Gru', con: 'Gru' },
  { id: 'Alnitak', hip: 26727, ra: ra(5, 40, 45.5), dec: dec(-1, 56, 33), mag: 1.77, bv: -0.21, name: 'Alnitak', koName: '알니타크', bayer: 'ζ Ori', con: 'Ori' },
  { id: 'Alioth', hip: 62956, ra: ra(12, 54, 1.7), dec: dec(55, 57, 35), mag: 1.77, bv: -0.02, name: 'Alioth', koName: '알리오트', bayer: 'ε UMa', con: 'UMa' },
  { id: 'Dubhe', hip: 54061, ra: ra(11, 3, 43.7), dec: dec(61, 45, 3), mag: 1.79, bv: 1.07, name: 'Dubhe', koName: '두베', bayer: 'α UMa', con: 'UMa' },
  { id: 'Mirfak', hip: 15863, ra: ra(3, 24, 19.4), dec: dec(49, 51, 40), mag: 1.80, bv: 0.48, name: 'Mirfak', koName: '미르파크', bayer: 'α Per', con: 'Per' },
  { id: 'Wezen', hip: 34444, ra: ra(7, 8, 23.5), dec: dec(-26, 23, 35), mag: 1.84, bv: 0.67, name: 'Wezen', koName: '웨젠', bayer: 'δ CMa', con: 'CMa' },
  { id: 'Sargas', hip: 86228, ra: ra(17, 37, 19.1), dec: dec(-42, 59, 52), mag: 1.87, bv: 0.40, name: 'Sargas', koName: '사르가스', bayer: 'θ Sco', con: 'Sco' },
  { id: 'Kaus Australis', hip: 90185, ra: ra(18, 24, 10.3), dec: dec(-34, 23, 5), mag: 1.85, bv: -0.03, name: 'Kaus Australis', koName: '카우스 아우스트랄리스', bayer: 'ε Sgr', con: 'Sgr' },
  { id: 'Avior', hip: 41037, ra: ra(8, 22, 30.8), dec: dec(-59, 30, 34), mag: 1.86, bv: 1.28, name: 'Avior', koName: '아비오르', bayer: 'ε Car', con: 'Car' },
  { id: 'Alkaid', hip: 67301, ra: ra(13, 47, 32.4), dec: dec(49, 18, 48), mag: 1.86, bv: -0.19, name: 'Alkaid', koName: '알카이드', bayer: 'η UMa', con: 'UMa' },
  { id: 'Menkalinan', hip: 28360, ra: ra(5, 59, 31.7), dec: dec(44, 56, 51), mag: 1.90, bv: 0.03, name: 'Menkalinan', koName: '멘칼리난', bayer: 'β Aur', con: 'Aur' },
  { id: 'Atria', hip: 82273, ra: ra(16, 48, 39.9), dec: dec(-69, 1, 40), mag: 1.92, bv: 1.44, name: 'Atria', koName: '아트리아', bayer: 'α TrA', con: 'TrA' },
  { id: 'Alhena', hip: 31681, ra: ra(6, 37, 42.7), dec: dec(16, 23, 57), mag: 1.93, bv: 0.00, name: 'Alhena', koName: '알헤나', bayer: 'γ Gem', con: 'Gem' },
  { id: 'Peacock', hip: 100751, ra: ra(20, 25, 38.9), dec: dec(-56, 44, 6), mag: 1.94, bv: -0.20, name: 'Peacock', koName: '피콕', bayer: 'α Pav', con: 'Pav' },
  { id: 'Alsephina', hip: 42913, ra: ra(8, 44, 42.2), dec: dec(-54, 42, 32), mag: 1.96, bv: 0.04, name: 'Alsephina', bayer: 'δ Vel', con: 'Vel' },
  { id: 'Mirzam', hip: 30324, ra: ra(6, 22, 42.0), dec: dec(-17, 57, 21), mag: 1.98, bv: -0.23, name: 'Mirzam', koName: '미르잠', bayer: 'β CMa', con: 'CMa' },
  { id: 'Polaris', hip: 11767, ra: ra(2, 31, 49.1), dec: dec(89, 15, 51), mag: 1.98, bv: 0.60, name: 'Polaris', koName: '북극성', bayer: 'α UMi', con: 'UMi' },
  { id: 'Alphard', hip: 46390, ra: ra(9, 27, 35.2), dec: dec(-8, 39, 31), mag: 1.98, bv: 1.44, name: 'Alphard', koName: '알파르드', bayer: 'α Hya', con: 'Hya' },
  { id: 'Hamal', hip: 9884, ra: ra(2, 7, 10.4), dec: dec(23, 27, 45), mag: 2.00, bv: 1.15, name: 'Hamal', koName: '하말', bayer: 'α Ari', con: 'Ari' },
  { id: 'Algieba', hip: 50583, ra: ra(10, 19, 58.3), dec: dec(19, 50, 30), mag: 2.01, bv: 1.15, name: 'Algieba', koName: '알기에바', bayer: 'γ Leo', con: 'Leo' },
  { id: 'Diphda', hip: 3419, ra: ra(0, 43, 35.4), dec: dec(-17, 59, 12), mag: 2.02, bv: 1.02, name: 'Diphda', koName: '디프다', bayer: 'β Cet', con: 'Cet' },
  { id: 'Mizar', hip: 65378, ra: ra(13, 23, 55.5), dec: dec(54, 55, 31), mag: 2.04, bv: 0.02, name: 'Mizar', koName: '미자르', bayer: 'ζ UMa', con: 'UMa' },
  { id: 'Nunki', hip: 92855, ra: ra(18, 55, 15.9), dec: dec(-26, 17, 48), mag: 2.05, bv: -0.22, name: 'Nunki', koName: '눈키', bayer: 'σ Sgr', con: 'Sgr' },
  { id: 'Menkent', hip: 68933, ra: ra(14, 6, 40.9), dec: dec(-36, 22, 12), mag: 2.06, bv: 1.01, name: 'Menkent', bayer: 'θ Cen', con: 'Cen' },
  { id: 'Mirach', hip: 5447, ra: ra(1, 9, 43.9), dec: dec(35, 37, 14), mag: 2.06, bv: 1.58, name: 'Mirach', koName: '미라크', bayer: 'β And', con: 'And' },
  { id: 'Alpheratz', hip: 677, ra: ra(0, 8, 23.3), dec: dec(29, 5, 26), mag: 2.06, bv: -0.11, name: 'Alpheratz', koName: '알페라츠', bayer: 'α And', con: 'And' },
  { id: 'Saiph', hip: 27366, ra: ra(5, 47, 45.4), dec: dec(-9, 40, 11), mag: 2.06, bv: -0.17, name: 'Saiph', koName: '사이프', bayer: 'κ Ori', con: 'Ori' },
  { id: 'Kochab', hip: 72607, ra: ra(14, 50, 42.3), dec: dec(74, 9, 20), mag: 2.08, bv: 1.47, name: 'Kochab', koName: '코카브', bayer: 'β UMi', con: 'UMi' },
  { id: 'Rasalhague', hip: 86032, ra: ra(17, 34, 56.1), dec: dec(12, 33, 36), mag: 2.08, bv: 0.15, name: 'Rasalhague', koName: '라살하게', bayer: 'α Oph', con: 'Oph' },
  { id: 'Algol', hip: 14576, ra: ra(3, 8, 10.1), dec: dec(40, 57, 20), mag: 2.12, bv: -0.05, name: 'Algol', koName: '알골', bayer: 'β Per', con: 'Per' },
  { id: 'Almach', hip: 9640, ra: ra(2, 3, 54.0), dec: dec(42, 19, 47), mag: 2.10, bv: 1.37, name: 'Almach', koName: '알마크', bayer: 'γ And', con: 'And' },
  { id: 'Denebola', hip: 57632, ra: ra(11, 49, 3.6), dec: dec(14, 34, 19), mag: 2.14, bv: 0.09, name: 'Denebola', koName: '데네볼라', bayer: 'β Leo', con: 'Leo' },
  { id: 'Tiaki', hip: 112122, ra: ra(22, 42, 40.0), dec: dec(-46, 53, 4), mag: 2.10, bv: 1.62, name: 'Tiaki', bayer: 'β Gru', con: 'Gru' },
  { id: 'Muhlifain', hip: 61932, ra: ra(12, 41, 31.0), dec: dec(-48, 57, 36), mag: 2.20, bv: -0.02, name: 'Muhlifain', bayer: 'γ Cen', con: 'Cen' },
  { id: 'Suhail', hip: 44816, ra: ra(9, 7, 59.8), dec: dec(-43, 25, 57), mag: 2.21, bv: 1.66, name: 'Suhail', bayer: 'λ Vel', con: 'Vel' },
  { id: 'Alphecca', hip: 76267, ra: ra(15, 34, 41.3), dec: dec(26, 42, 53), mag: 2.23, bv: -0.02, name: 'Alphecca', koName: '알페카', bayer: 'α CrB', con: 'CrB' },
  { id: 'Mintaka', hip: 25930, ra: ra(5, 32, 0.4), dec: dec(-0, 17, 57), mag: 2.23, bv: -0.22, name: 'Mintaka', koName: '민타카', bayer: 'δ Ori', con: 'Ori' },
  { id: 'Sadr', hip: 100453, ra: ra(20, 22, 13.7), dec: dec(40, 15, 24), mag: 2.23, bv: 0.68, name: 'Sadr', koName: '사드르', bayer: 'γ Cyg', con: 'Cyg' },
  { id: 'Eltanin', hip: 87833, ra: ra(17, 56, 36.4), dec: dec(51, 29, 20), mag: 2.23, bv: 1.52, name: 'Eltanin', koName: '엘타닌', bayer: 'γ Dra', con: 'Dra' },
  { id: 'Schedar', hip: 3179, ra: ra(0, 40, 30.4), dec: dec(56, 32, 14), mag: 2.23, bv: 1.17, name: 'Schedar', koName: '셰다르', bayer: 'α Cas', con: 'Cas' },
  { id: 'Naos', hip: 39429, ra: ra(8, 3, 35.1), dec: dec(-40, 0, 12), mag: 2.25, bv: -0.27, name: 'Naos', bayer: 'ζ Pup', con: 'Pup' },
  { id: 'Caph', hip: 746, ra: ra(0, 9, 10.7), dec: dec(59, 8, 59), mag: 2.27, bv: 0.34, name: 'Caph', koName: '카프', bayer: 'β Cas', con: 'Cas' },
  { id: 'Izar', hip: 72105, ra: ra(14, 44, 59.2), dec: dec(27, 4, 27), mag: 2.35, bv: 0.97, name: 'Izar', koName: '이자르', bayer: 'ε Boo', con: 'Boo' },
  { id: 'Dschubba', hip: 78401, ra: ra(16, 0, 20.0), dec: dec(-22, 37, 18), mag: 2.32, bv: -0.12, name: 'Dschubba', bayer: 'δ Sco', con: 'Sco' },
  { id: 'Larawag', hip: 82396, ra: ra(16, 50, 9.8), dec: dec(-34, 17, 36), mag: 2.29, bv: 1.15, name: 'Larawag', bayer: 'ε Sco', con: 'Sco' },
  { id: 'Merak', hip: 53910, ra: ra(11, 1, 50.5), dec: dec(56, 22, 57), mag: 2.37, bv: -0.02, name: 'Merak', koName: '메라크', bayer: 'β UMa', con: 'UMa' },
  { id: 'Ankaa', hip: 2081, ra: ra(0, 26, 17.1), dec: dec(-42, 18, 22), mag: 2.39, bv: 1.09, name: 'Ankaa', bayer: 'α Phe', con: 'Phe' },
  { id: 'Enif', hip: 107315, ra: ra(21, 44, 11.2), dec: dec(9, 52, 30), mag: 2.39, bv: 1.53, name: 'Enif', koName: '에니프', bayer: 'ε Peg', con: 'Peg' },
  { id: 'Girtab', hip: 86670, ra: ra(17, 42, 29.3), dec: dec(-39, 1, 48), mag: 2.41, bv: -0.22, name: 'Girtab', bayer: 'κ Sco', con: 'Sco' },
  { id: 'Scheat', hip: 113881, ra: ra(23, 3, 46.5), dec: dec(28, 4, 58), mag: 2.42, bv: 1.67, name: 'Scheat', koName: '셰아트', bayer: 'β Peg', con: 'Peg' },
  { id: 'Sabik', hip: 84012, ra: ra(17, 10, 22.7), dec: dec(-15, 43, 30), mag: 2.43, bv: 0.06, name: 'Sabik', bayer: 'η Oph', con: 'Oph' },
  { id: 'Phecda', hip: 58001, ra: ra(11, 53, 49.8), dec: dec(53, 41, 41), mag: 2.44, bv: 0.00, name: 'Phecda', koName: '페크다', bayer: 'γ UMa', con: 'UMa' },
  { id: 'Aludra', hip: 35904, ra: ra(7, 24, 5.7), dec: dec(-29, 18, 11), mag: 2.45, bv: -0.08, name: 'Aludra', bayer: 'η CMa', con: 'CMa' },
  { id: 'Alderamin', hip: 105199, ra: ra(21, 18, 34.8), dec: dec(62, 35, 8), mag: 2.45, bv: 0.22, name: 'Alderamin', koName: '알데라민', bayer: 'α Cep', con: 'Cep' },
  { id: 'Gamma Cas', hip: 4427, ra: ra(0, 56, 42.5), dec: dec(60, 43, 0), mag: 2.15, bv: -0.15, name: 'Navi', bayer: 'γ Cas', con: 'Cas' },
  { id: 'Gienah', hip: 102488, ra: ra(20, 46, 12.7), dec: dec(33, 58, 13), mag: 2.48, bv: 1.03, name: 'Aljanah', bayer: 'ε Cyg', con: 'Cyg' },
  { id: 'Markab', hip: 113963, ra: ra(23, 4, 45.7), dec: dec(15, 12, 19), mag: 2.49, bv: -0.04, name: 'Markab', koName: '마르카브', bayer: 'α Peg', con: 'Peg' },
  { id: 'Menkar', hip: 14135, ra: ra(3, 2, 16.8), dec: dec(4, 5, 23), mag: 2.53, bv: 1.64, name: 'Menkar', koName: '멘카르', bayer: 'α Cet', con: 'Cet' },
  { id: 'Acrab', hip: 78820, ra: ra(16, 5, 26.2), dec: dec(-19, 48, 19), mag: 2.56, bv: -0.07, name: 'Acrab', bayer: 'β Sco', con: 'Sco' },
  { id: 'Zosma', hip: 54872, ra: ra(11, 14, 6.5), dec: dec(20, 31, 25), mag: 2.56, bv: 0.12, name: 'Zosma', bayer: 'δ Leo', con: 'Leo' },
  { id: 'Arneb', hip: 25985, ra: ra(5, 32, 43.8), dec: dec(-17, 49, 20), mag: 2.58, bv: 0.21, name: 'Arneb', bayer: 'α Lep', con: 'Lep' },
  { id: 'Gienah Corvi', hip: 59803, ra: ra(12, 15, 48.4), dec: dec(-17, 32, 31), mag: 2.58, bv: -0.11, name: 'Gienah', bayer: 'γ Crv', con: 'Crv' },
  { id: 'Ascella', hip: 93506, ra: ra(19, 2, 36.7), dec: dec(-29, 52, 48), mag: 2.60, bv: 0.08, name: 'Ascella', bayer: 'ζ Sgr', con: 'Sgr' },
  { id: 'Zubeneschamali', hip: 74785, ra: ra(15, 17, 0.4), dec: dec(-9, 22, 58), mag: 2.61, bv: -0.11, name: 'Zubeneschamali', bayer: 'β Lib', con: 'Lib' },
  { id: 'Sheratan', hip: 8903, ra: ra(1, 54, 38.4), dec: dec(20, 48, 29), mag: 2.64, bv: 0.13, name: 'Sheratan', bayer: 'β Ari', con: 'Ari' },
  { id: 'Mahasim', hip: 28380, ra: ra(5, 59, 43.3), dec: dec(37, 12, 45), mag: 2.62, bv: -0.08, name: 'Mahasim', bayer: 'θ Aur', con: 'Aur' },
  { id: 'Phact', hip: 26634, ra: ra(5, 39, 38.9), dec: dec(-34, 4, 27), mag: 2.64, bv: -0.13, name: 'Phact', bayer: 'α Col', con: 'Col' },
  { id: 'Ruchbah', hip: 6686, ra: ra(1, 25, 49.0), dec: dec(60, 14, 7), mag: 2.68, bv: 0.13, name: 'Ruchbah', bayer: 'δ Cas', con: 'Cas' },
  { id: 'Muphrid', hip: 67927, ra: ra(13, 54, 41.1), dec: dec(18, 23, 52), mag: 2.68, bv: 0.58, name: 'Muphrid', bayer: 'η Boo', con: 'Boo' },
  { id: 'Unukalhai', hip: 77070, ra: ra(15, 44, 16.1), dec: dec(6, 25, 32), mag: 2.63, bv: 1.17, name: 'Unukalhai', bayer: 'α Ser', con: 'Ser' },
  { id: 'Hassaleh', hip: 23015, ra: ra(4, 56, 59.6), dec: dec(33, 9, 58), mag: 2.69, bv: 1.53, name: 'Hassaleh', bayer: 'ι Aur', con: 'Aur' },
  { id: 'Tarazed', hip: 97278, ra: ra(19, 46, 15.6), dec: dec(10, 36, 48), mag: 2.72, bv: 1.52, name: 'Tarazed', bayer: 'γ Aql', con: 'Aql' },
  { id: 'Kaus Media', hip: 89931, ra: ra(18, 20, 59.7), dec: dec(-29, 49, 41), mag: 2.72, bv: 1.38, name: 'Kaus Media', bayer: 'δ Sgr', con: 'Sgr' },
  { id: 'Zubenelgenubi', hip: 72622, ra: ra(14, 50, 52.7), dec: dec(-16, 2, 30), mag: 2.75, bv: 0.15, name: 'Zubenelgenubi', bayer: 'α² Lib', con: 'Lib' },
  { id: 'Rastaban', hip: 85670, ra: ra(17, 30, 25.9), dec: dec(52, 18, 5), mag: 2.79, bv: 0.98, name: 'Rastaban', bayer: 'β Dra', con: 'Dra' },
  { id: 'Vindemiatrix', hip: 63608, ra: ra(13, 2, 10.6), dec: dec(10, 57, 33), mag: 2.85, bv: 0.94, name: 'Vindemiatrix', bayer: 'ε Vir', con: 'Vir' },
  { id: 'Algenib', hip: 1067, ra: ra(0, 13, 14.2), dec: dec(15, 11, 1), mag: 2.83, bv: -0.23, name: 'Algenib', bayer: 'γ Peg', con: 'Peg' },
  { id: 'Beta Tri Aust', hip: 77952, ra: ra(15, 55, 8.6), dec: dec(-63, 25, 51), mag: 2.83, bv: 0.29, name: 'Betria', bayer: 'β TrA', con: 'TrA' },
  { id: 'Kaus Borealis', hip: 90496, ra: ra(18, 27, 58.2), dec: dec(-25, 25, 18), mag: 2.82, bv: 1.04, name: 'Kaus Borealis', bayer: 'λ Sgr', con: 'Sgr' },
  { id: 'Alcyone', hip: 17702, ra: ra(3, 47, 29.1), dec: dec(24, 6, 18), mag: 2.87, bv: -0.09, name: 'Alcyone', koName: '알키오네 (플레이아데스)', bayer: 'η Tau', con: 'Tau' },
  { id: 'Deneb Algedi', hip: 107556, ra: ra(21, 47, 2.4), dec: dec(-16, 7, 38), mag: 2.85, bv: 0.29, name: 'Deneb Algedi', bayer: 'δ Cap', con: 'Cap' },
  { id: 'Sadalmelik', hip: 109074, ra: ra(22, 5, 47.0), dec: dec(-0, 19, 11), mag: 2.95, bv: 0.97, name: 'Sadalmelik', bayer: 'α Aqr', con: 'Aqr' },
  { id: 'Sadalsuud', hip: 106278, ra: ra(21, 31, 33.5), dec: dec(-5, 34, 16), mag: 2.90, bv: 0.83, name: 'Sadalsuud', bayer: 'β Aqr', con: 'Aqr' },
  { id: 'Beta Cyg', hip: 95947, ra: ra(19, 30, 43.3), dec: dec(27, 57, 35), mag: 3.05, bv: 1.13, name: 'Albireo', koName: '알비레오', bayer: 'β Cyg', con: 'Cyg' },
  { id: 'Kornephoros', hip: 80816, ra: ra(16, 30, 13.2), dec: dec(21, 29, 23), mag: 2.78, bv: 0.94, name: 'Kornephoros', bayer: 'β Her', con: 'Her' },
  { id: 'Alnasl', hip: 88635, ra: ra(18, 5, 48.5), dec: dec(-30, 25, 27), mag: 2.98, bv: 1.00, name: 'Alnasl', bayer: 'γ Sgr', con: 'Sgr' },
  { id: 'Cebalrai', hip: 86742, ra: ra(17, 43, 28.4), dec: dec(4, 34, 2), mag: 2.76, bv: 1.16, name: 'Cebalrai', bayer: 'β Oph', con: 'Oph' },
  { id: 'Delta Cyg', hip: 97165, ra: ra(19, 44, 58.5), dec: dec(45, 7, 51), mag: 2.87, bv: -0.03, name: 'Fawaris', bayer: 'δ Cyg', con: 'Cyg' },
  { id: 'Beta Ari', hip: 8903, ra: ra(1, 54, 38.4), dec: dec(20, 48, 29), mag: 2.64, bv: 0.13, name: 'Sheratan', bayer: 'β Ari', con: 'Ari' },
  { id: 'Gamma Per', hip: 14328, ra: ra(3, 4, 47.8), dec: dec(53, 30, 23), mag: 2.93, bv: 0.70, bayer: 'γ Per', con: 'Per' },
  { id: 'Epsilon Per', hip: 18532, ra: ra(3, 57, 51.2), dec: dec(40, 0, 37), mag: 2.89, bv: -0.18, bayer: 'ε Per', con: 'Per' },
  { id: 'Zeta Per', hip: 18246, ra: ra(3, 54, 7.9), dec: dec(31, 53, 1), mag: 2.85, bv: 0.12, bayer: 'ζ Per', con: 'Per' },
  { id: 'Zeta Tau', hip: 26451, ra: ra(5, 37, 38.7), dec: dec(21, 8, 33), mag: 3.00, bv: -0.19, name: 'Tianguan', bayer: 'ζ Tau', con: 'Tau' },
  { id: 'Mebsuta', hip: 32246, ra: ra(6, 43, 55.9), dec: dec(25, 7, 52), mag: 3.06, bv: 1.40, name: 'Mebsuta', bayer: 'ε Gem', con: 'Gem' },
  { id: 'Tejat', hip: 30343, ra: ra(6, 22, 57.6), dec: dec(22, 30, 49), mag: 2.88, bv: 1.64, name: 'Tejat', bayer: 'μ Gem', con: 'Gem' },
  { id: 'Alhena2', hip: 34088, ra: ra(7, 4, 6.5), dec: dec(20, 34, 13), mag: 3.79, bv: 0.45, name: 'Mekbuda', bayer: 'ζ Gem', con: 'Gem' },
  { id: 'Wasat', hip: 35550, ra: ra(7, 20, 7.4), dec: dec(21, 58, 56), mag: 3.53, bv: 0.34, name: 'Wasat', bayer: 'δ Gem', con: 'Gem' },
  { id: 'Megrez', hip: 59774, ra: ra(12, 15, 25.6), dec: dec(57, 1, 57), mag: 3.31, bv: 0.08, name: 'Megrez', koName: '메그레즈', bayer: 'δ UMa', con: 'UMa' },
  { id: 'Cor Caroli', hip: 63125, ra: ra(12, 56, 1.7), dec: dec(38, 19, 6), mag: 2.89, bv: -0.12, name: 'Cor Caroli', koName: '코르 카롤리', bayer: 'α CVn', con: 'CVn' },
  { id: 'Pherkad', hip: 75097, ra: ra(15, 20, 43.7), dec: dec(71, 50, 2), mag: 3.05, bv: 0.05, name: 'Pherkad', bayer: 'γ UMi', con: 'UMi' },
  { id: 'Thuban', hip: 68756, ra: ra(14, 4, 23.3), dec: dec(64, 22, 33), mag: 3.65, bv: -0.05, name: 'Thuban', koName: '투반', bayer: 'α Dra', con: 'Dra' },
  { id: 'Sulafat', hip: 93194, ra: ra(18, 58, 56.6), dec: dec(32, 41, 22), mag: 3.24, bv: -0.05, name: 'Sulafat', bayer: 'γ Lyr', con: 'Lyr' },
  { id: 'Sheliak', hip: 92420, ra: ra(18, 50, 4.8), dec: dec(33, 21, 46), mag: 3.52, bv: 0.00, name: 'Sheliak', bayer: 'β Lyr', con: 'Lyr' },
  { id: 'Epsilon Lyr', hip: 91919, ra: ra(18, 44, 20.3), dec: dec(39, 40, 12), mag: 4.67, bv: 0.15, name: 'Double Double', koName: '더블 더블 (ε Lyr)', bayer: 'ε Lyr', con: 'Lyr' },
  { id: 'Algorab', hip: 60965, ra: ra(12, 29, 51.9), dec: dec(-16, 30, 56), mag: 2.95, bv: -0.05, name: 'Algorab', bayer: 'δ Crv', con: 'Crv' },
  { id: 'Porrima', hip: 61941, ra: ra(12, 41, 39.6), dec: dec(-1, 26, 58), mag: 2.74, bv: 0.36, name: 'Porrima', bayer: 'γ Vir', con: 'Vir' },
  { id: 'Zaniah', hip: 60129, ra: ra(12, 19, 54.4), dec: dec(-0, 40, 0), mag: 3.89, bv: 0.06, bayer: 'η Vir', con: 'Vir' },
  { id: 'Zavijava', hip: 57757, ra: ra(11, 50, 41.7), dec: dec(1, 45, 53), mag: 3.60, bv: 0.55, bayer: 'β Vir', con: 'Vir' },
  { id: 'Chertan', hip: 54879, ra: ra(11, 14, 14.4), dec: dec(15, 25, 46), mag: 3.33, bv: 0.05, name: 'Chertan', bayer: 'θ Leo', con: 'Leo' },
  { id: 'Adhafera', hip: 50335, ra: ra(10, 16, 41.4), dec: dec(23, 25, 2), mag: 3.44, bv: 0.31, bayer: 'ζ Leo', con: 'Leo' },
  { id: 'Ras Elased', hip: 47908, ra: ra(9, 45, 51.1), dec: dec(23, 46, 27), mag: 2.98, bv: 0.81, name: 'Algenubi', bayer: 'ε Leo', con: 'Leo' },
  { id: 'Eta Leo', hip: 49583, ra: ra(10, 7, 19.9), dec: dec(16, 45, 46), mag: 3.48, bv: -0.03, bayer: 'η Leo', con: 'Leo' },
  { id: 'Segin', hip: 8886, ra: ra(1, 54, 23.7), dec: dec(63, 40, 12), mag: 3.35, bv: -0.15, name: 'Segin', bayer: 'ε Cas', con: 'Cas' },
  { id: 'Achird', hip: 3821, ra: ra(0, 49, 6.3), dec: dec(57, 48, 55), mag: 3.45, bv: 0.57, name: 'Achird', bayer: 'η Cas', con: 'Cas' },
  { id: 'Hatsya', hip: 26241, ra: ra(5, 35, 26.0), dec: dec(-5, 54, 36), mag: 2.77, bv: -0.24, name: 'Hatysa', bayer: 'ι Ori', con: 'Ori' },
  { id: 'Meissa', hip: 26207, ra: ra(5, 35, 8.3), dec: dec(9, 56, 3), mag: 3.39, bv: -0.18, name: 'Meissa', bayer: 'λ Ori', con: 'Ori' },
  { id: 'Tabit', hip: 22449, ra: ra(4, 49, 50.4), dec: dec(6, 57, 41), mag: 3.19, bv: 0.45, name: 'Tabit', bayer: 'π³ Ori', con: 'Ori' },
  { id: 'Gomeisa', hip: 36188, ra: ra(7, 27, 9.0), dec: dec(8, 17, 21), mag: 2.89, bv: -0.10, name: 'Gomeisa', bayer: 'β CMi', con: 'CMi' },
  { id: 'Furud', hip: 30122, ra: ra(6, 20, 18.8), dec: dec(-30, 3, 48), mag: 3.02, bv: -0.18, bayer: 'ζ CMa', con: 'CMa' },
  { id: 'Muliphein', hip: 34045, ra: ra(7, 3, 45.5), dec: dec(-15, 38, 0), mag: 4.11, bv: -0.11, bayer: 'γ CMa', con: 'CMa' },
  { id: 'Matar', hip: 112158, ra: ra(22, 43, 0.1), dec: dec(30, 13, 16), mag: 2.94, bv: 0.86, name: 'Matar', bayer: 'η Peg', con: 'Peg' },
  { id: 'Homam', hip: 112029, ra: ra(22, 41, 27.7), dec: dec(10, 49, 53), mag: 3.41, bv: -0.09, name: 'Homam', bayer: 'ζ Peg', con: 'Peg' },
  { id: 'Biham', hip: 109427, ra: ra(22, 10, 11.9), dec: dec(6, 11, 52), mag: 3.53, bv: 0.08, name: 'Biham', bayer: 'θ Peg', con: 'Peg' },
  { id: 'Mothallah', hip: 8796, ra: ra(1, 53, 3.3), dec: dec(29, 34, 44), mag: 3.42, bv: 0.49, name: 'Mothallah', bayer: 'α Tri', con: 'Tri' },
  { id: 'Beta Tri', hip: 10064, ra: ra(2, 9, 32.6), dec: dec(34, 59, 14), mag: 3.00, bv: 0.14, bayer: 'β Tri', con: 'Tri' },
  { id: 'Delta And', hip: 3092, ra: ra(0, 39, 19.6), dec: dec(30, 51, 40), mag: 3.27, bv: 1.28, bayer: 'δ And', con: 'And' },
  { id: 'Mu And', hip: 4436, ra: ra(0, 56, 45.2), dec: dec(38, 29, 58), mag: 3.87, bv: 0.13, bayer: 'μ And', con: 'And' },
  { id: 'Nu And', hip: 3881, ra: ra(0, 49, 48.8), dec: dec(41, 4, 44), mag: 4.53, bv: -0.15, bayer: 'ν And', con: 'And' },
  { id: 'Alrescha', hip: 9487, ra: ra(2, 2, 2.8), dec: dec(2, 45, 50), mag: 3.82, bv: 0.02, name: 'Alrescha', bayer: 'α Psc', con: 'Psc' },
  { id: 'Kaitos', hip: 106481, ra: ra(21, 33, 40.0), dec: dec(-16, 40, 4), mag: 3.68, bv: 0.99, bayer: 'γ Cap', con: 'Cap' },
  { id: 'Algedi', hip: 100064, ra: ra(20, 17, 38.9), dec: dec(-12, 30, 30), mag: 3.57, bv: 1.07, name: 'Algedi', bayer: 'α² Cap', con: 'Cap' },
  { id: 'Dabih', hip: 100345, ra: ra(20, 21, 0.7), dec: dec(-14, 46, 53), mag: 3.08, bv: 0.79, name: 'Dabih', bayer: 'β Cap', con: 'Cap' },
  { id: 'Sualocin', hip: 101958, ra: ra(20, 39, 38.3), dec: dec(15, 54, 43), mag: 3.77, bv: -0.06, name: 'Sualocin', bayer: 'α Del', con: 'Del' },
  { id: 'Rotanev', hip: 101769, ra: ra(20, 37, 32.9), dec: dec(14, 35, 43), mag: 3.63, bv: 0.44, name: 'Rotanev', bayer: 'β Del', con: 'Del' },
  { id: 'Sham', hip: 96757, ra: ra(19, 40, 5.8), dec: dec(18, 0, 50), mag: 4.37, bv: 0.78, name: 'Sham', bayer: 'α Sge', con: 'Sge' },
  { id: 'Gamma Sge', hip: 98337, ra: ra(19, 58, 45.4), dec: dec(19, 29, 32), mag: 3.51, bv: 1.57, bayer: 'γ Sge', con: 'Sge' },
  { id: 'Rasalgethi', hip: 84345, ra: ra(17, 14, 38.9), dec: dec(14, 23, 25), mag: 3.48, bv: 1.44, name: 'Rasalgethi', bayer: 'α Her', con: 'Her' },
  { id: 'Zeta Her', hip: 81693, ra: ra(16, 41, 17.2), dec: dec(31, 36, 10), mag: 2.81, bv: 0.65, name: 'Rutilicus', bayer: 'ζ Her', con: 'Her' },
  { id: 'Pi Her', hip: 84380, ra: ra(17, 15, 2.8), dec: dec(36, 48, 33), mag: 3.16, bv: 1.44, bayer: 'π Her', con: 'Her' },
  { id: 'Eta Her', hip: 81833, ra: ra(16, 42, 53.8), dec: dec(38, 55, 20), mag: 3.53, bv: 0.92, bayer: 'η Her', con: 'Her' },
  { id: 'Sarin', hip: 84379, ra: ra(17, 15, 1.9), dec: dec(24, 50, 21), mag: 3.14, bv: 0.08, name: 'Sarin', bayer: 'δ Her', con: 'Her' },
  { id: 'Seginus', hip: 71075, ra: ra(14, 32, 4.7), dec: dec(38, 18, 30), mag: 3.04, bv: 0.19, name: 'Seginus', bayer: 'γ Boo', con: 'Boo' },
  { id: 'Nekkar', hip: 73555, ra: ra(15, 1, 56.8), dec: dec(40, 23, 26), mag: 3.50, bv: 0.97, name: 'Nekkar', bayer: 'β Boo', con: 'Boo' },
  { id: 'Delta Boo', hip: 74666, ra: ra(15, 15, 30.2), dec: dec(33, 18, 53), mag: 3.47, bv: 0.95, bayer: 'δ Boo', con: 'Boo' },
  { id: 'Acubens', hip: 44066, ra: ra(8, 58, 29.2), dec: dec(11, 51, 28), mag: 4.25, bv: 0.14, name: 'Acubens', bayer: 'α Cnc', con: 'Cnc' },
  { id: 'Asellus Australis', hip: 42911, ra: ra(8, 44, 41.1), dec: dec(18, 9, 16), mag: 3.94, bv: 1.08, bayer: 'δ Cnc', con: 'Cnc' },
  { id: 'Asellus Borealis', hip: 42806, ra: ra(8, 43, 17.1), dec: dec(21, 28, 7), mag: 4.66, bv: 0.01, bayer: 'γ Cnc', con: 'Cnc' },
  { id: 'Beta Cnc', hip: 40526, ra: ra(8, 16, 30.9), dec: dec(9, 11, 8), mag: 3.52, bv: 1.48, name: 'Tarf', bayer: 'β Cnc', con: 'Cnc' },
  { id: 'Iota Cnc', hip: 43103, ra: ra(8, 46, 41.8), dec: dec(28, 45, 36), mag: 4.02, bv: 1.01, bayer: 'ι Cnc', con: 'Cnc' },
  { id: 'Alfirk', hip: 106032, ra: ra(21, 28, 39.6), dec: dec(70, 33, 39), mag: 3.23, bv: -0.22, name: 'Alfirk', bayer: 'β Cep', con: 'Cep' },
  { id: 'Errai', hip: 116727, ra: ra(23, 39, 20.8), dec: dec(77, 37, 56), mag: 3.21, bv: 1.03, name: 'Errai', bayer: 'γ Cep', con: 'Cep' },
  { id: 'Zeta Cep', hip: 109492, ra: ra(22, 10, 51.3), dec: dec(58, 12, 5), mag: 3.35, bv: 1.57, bayer: 'ζ Cep', con: 'Cep' },
  { id: 'Iota Cep', hip: 112724, ra: ra(22, 49, 40.8), dec: dec(66, 12, 1), mag: 3.52, bv: 1.05, bayer: 'ι Cep', con: 'Cep' },
  { id: 'Garnet Star', hip: 107259, ra: ra(21, 43, 30.5), dec: dec(58, 46, 48), mag: 4.08, bv: 2.35, name: 'Garnet Star', koName: '석류별 (μ Cep)', bayer: 'μ Cep', con: 'Cep' },
  { id: 'Kraz', hip: 61359, ra: ra(12, 34, 23.2), dec: dec(-23, 23, 48), mag: 2.65, bv: 1.09, name: 'Kraz', bayer: 'β Crv', con: 'Crv' },
  { id: 'Minkar', hip: 59316, ra: ra(12, 10, 7.5), dec: dec(-22, 37, 11), mag: 3.00, bv: 1.33, name: 'Minkar', bayer: 'ε Crv', con: 'Crv' },
  { id: 'Alchiba', hip: 59199, ra: ra(12, 8, 24.8), dec: dec(-24, 43, 44), mag: 4.02, bv: 0.32, name: 'Alchiba', bayer: 'α Crv', con: 'Crv' },
  { id: 'Lesath', hip: 85696, ra: ra(17, 30, 45.8), dec: dec(-37, 17, 45), mag: 2.69, bv: -0.22, name: 'Lesath', bayer: 'υ Sco', con: 'Sco' },
  { id: 'Wei', hip: 82514, ra: ra(16, 51, 52.2), dec: dec(-38, 2, 51), mag: 2.99, bv: -0.22, bayer: 'μ¹ Sco', con: 'Sco' },
  { id: 'Pi Sco', hip: 78265, ra: ra(15, 58, 51.1), dec: dec(-26, 6, 51), mag: 2.89, bv: -0.19, bayer: 'π Sco', con: 'Sco' },
  { id: 'Tau Sco', hip: 81266, ra: ra(16, 35, 53.0), dec: dec(-28, 12, 58), mag: 2.82, bv: -0.25, name: 'Paikauhale', bayer: 'τ Sco', con: 'Sco' },
  { id: 'Eta Sco', hip: 84143, ra: ra(17, 12, 9.2), dec: dec(-43, 14, 21), mag: 3.33, bv: 0.41, bayer: 'η Sco', con: 'Sco' },
  { id: 'Iota1 Sco', hip: 87073, ra: ra(17, 47, 35.1), dec: dec(-40, 7, 37), mag: 3.03, bv: 0.51, bayer: 'ι¹ Sco', con: 'Sco' },
  { id: 'Kaus Borealis2', hip: 92041, ra: ra(18, 45, 39.4), dec: dec(-26, 59, 27), mag: 3.17, bv: 0.40, name: 'Kaus/Phi', bayer: 'φ Sgr', con: 'Sgr' },
  { id: 'Tau Sgr', hip: 93864, ra: ra(19, 6, 56.4), dec: dec(-27, 40, 14), mag: 3.32, bv: 1.19, bayer: 'τ Sgr', con: 'Sgr' },
  { id: 'Albaldah', hip: 94141, ra: ra(19, 9, 45.8), dec: dec(-21, 1, 25), mag: 2.89, bv: 0.35, name: 'Albaldah', bayer: 'π Sgr', con: 'Sgr' },
  { id: 'Polis', hip: 89341, ra: ra(18, 13, 45.8), dec: dec(-21, 3, 32), mag: 3.86, bv: 0.22, name: 'Polis', bayer: 'μ Sgr', con: 'Sgr' },
  { id: 'Skat', hip: 113136, ra: ra(22, 54, 39.0), dec: dec(-15, 49, 15), mag: 3.27, bv: 0.06, name: 'Skat', bayer: 'δ Aqr', con: 'Aqr' },
  { id: 'Sadachbia', hip: 110395, ra: ra(22, 21, 39.4), dec: dec(-1, 23, 14), mag: 3.84, bv: -0.05, name: 'Sadachbia', bayer: 'γ Aqr', con: 'Aqr' },
  { id: 'Albali', hip: 102618, ra: ra(20, 47, 40.6), dec: dec(-9, 29, 45), mag: 3.77, bv: 0.00, name: 'Albali', bayer: 'ε Aqr', con: 'Aqr' },
  { id: 'Cursa', hip: 23875, ra: ra(5, 7, 51.0), dec: dec(-5, 5, 11), mag: 2.79, bv: 0.13, name: 'Cursa', bayer: 'β Eri', con: 'Eri' },
  { id: 'Zaurak', hip: 18543, ra: ra(3, 58, 1.8), dec: dec(-13, 30, 31), mag: 2.95, bv: 1.59, name: 'Zaurak', bayer: 'γ Eri', con: 'Eri' },
  { id: 'Acamar', hip: 13847, ra: ra(2, 58, 15.7), dec: dec(-40, 18, 17), mag: 2.88, bv: 0.13, name: 'Acamar', bayer: 'θ Eri', con: 'Eri' },
  { id: 'Baten Kaitos', hip: 8645, ra: ra(1, 51, 27.6), dec: dec(-10, 20, 6), mag: 3.74, bv: 1.07, bayer: 'ζ Cet', con: 'Cet' },
  { id: 'Mira', hip: 10826, ra: ra(2, 19, 20.8), dec: dec(-2, 58, 39), mag: 3.04, bv: 1.53, name: 'Mira', koName: '미라 (ο Cet)', bayer: 'ο Cet', con: 'Cet' },
  { id: 'Deneb Kaitos Shemali', hip: 5364, ra: ra(1, 8, 35.4), dec: dec(-10, 10, 56), mag: 3.44, bv: 1.14, bayer: 'η Cet', con: 'Cet' },
  { id: 'Gamma Cet', hip: 12706, ra: ra(2, 43, 18.0), dec: dec(3, 14, 9), mag: 3.47, bv: 0.09, name: 'Kaffaljidhma', bayer: 'γ Cet', con: 'Cet' },
  { id: 'Gamma Cep', hip: 116727, ra: ra(23, 39, 20.8), dec: dec(77, 37, 56), mag: 3.21, bv: 1.03, bayer: 'γ Cep', con: 'Cep' },
  { id: 'Iota Aur', hip: 23015, ra: ra(4, 56, 59.6), dec: dec(33, 9, 58), mag: 2.69, bv: 1.53, bayer: 'ι Aur', con: 'Aur' },
  { id: 'Alnath', hip: 25428, ra: ra(5, 26, 17.5), dec: dec(28, 36, 27), mag: 1.65, bv: -0.13, bayer: 'β Tau', con: 'Tau' },
  { id: 'Delta Tau', hip: 20205, ra: ra(4, 19, 47.6), dec: dec(17, 32, 33), mag: 3.76, bv: 0.99, bayer: 'δ¹ Tau', con: 'Tau' },
  { id: 'Ain', hip: 20889, ra: ra(4, 28, 37.0), dec: dec(19, 10, 50), mag: 3.53, bv: 1.01, name: 'Ain', bayer: 'ε Tau', con: 'Tau' },
  { id: 'Lambda Tau', hip: 18724, ra: ra(4, 0, 40.8), dec: dec(12, 29, 25), mag: 3.47, bv: -0.10, bayer: 'λ Tau', con: 'Tau' },
  { id: 'Eta Dra', hip: 80331, ra: ra(16, 23, 59.5), dec: dec(61, 30, 51), mag: 2.74, bv: 0.91, name: 'Athebyne', bayer: 'η Dra', con: 'Dra' },
  { id: 'Zeta Dra', hip: 83895, ra: ra(17, 8, 47.2), dec: dec(65, 42, 53), mag: 3.17, bv: -0.12, name: 'Aldhibah', bayer: 'ζ Dra', con: 'Dra' },
  { id: 'Iota Dra', hip: 75458, ra: ra(15, 24, 55.8), dec: dec(58, 57, 58), mag: 3.29, bv: 1.17, name: 'Edasich', bayer: 'ι Dra', con: 'Dra' },
  { id: 'Delta Dra', hip: 94376, ra: ra(19, 12, 33.3), dec: dec(67, 39, 42), mag: 3.07, bv: 1.00, name: 'Altais', bayer: 'δ Dra', con: 'Dra' },
  { id: 'Chi Dra', hip: 89937, ra: ra(18, 21, 3.4), dec: dec(72, 43, 58), mag: 3.57, bv: 0.49, bayer: 'χ Dra', con: 'Dra' },
  { id: 'Lambda Dra', hip: 56211, ra: ra(11, 31, 24.2), dec: dec(69, 19, 52), mag: 3.85, bv: 1.62, name: 'Giausar', bayer: 'λ Dra', con: 'Dra' },
  { id: 'Kappa Dra', hip: 61281, ra: ra(12, 33, 29.0), dec: dec(69, 47, 18), mag: 3.87, bv: -0.14, bayer: 'κ Dra', con: 'Dra' },
  { id: 'Xi Dra', hip: 87585, ra: ra(17, 53, 31.7), dec: dec(56, 52, 22), mag: 3.75, bv: 1.18, name: 'Grumium', bayer: 'ξ Dra', con: 'Dra' },
  { id: 'Nu Dra', hip: 85819, ra: ra(17, 32, 10.6), dec: dec(55, 11, 3), mag: 4.89, bv: 0.25, name: 'Kuma', bayer: 'ν Dra', con: 'Dra' },
  { id: 'Gamma1 Leo', hip: 50583, ra: ra(10, 19, 58.3), dec: dec(19, 50, 30), mag: 2.01, bv: 1.15, bayer: 'γ¹ Leo', con: 'Leo' },
  { id: 'Mu Leo', hip: 48455, ra: ra(9, 52, 45.8), dec: dec(26, 0, 25), mag: 3.88, bv: 1.22, name: 'Rasalas', bayer: 'μ Leo', con: 'Leo' },
  { id: 'Theta UMa', hip: 46853, ra: ra(9, 32, 51.4), dec: dec(51, 40, 38), mag: 3.17, bv: 0.46, bayer: 'θ UMa', con: 'UMa' },
  { id: 'Iota UMa', hip: 44127, ra: ra(8, 59, 12.5), dec: dec(48, 2, 31), mag: 3.14, bv: 0.19, name: 'Talitha', bayer: 'ι UMa', con: 'UMa' },
  { id: 'Lambda UMa', hip: 50372, ra: ra(10, 17, 5.8), dec: dec(42, 54, 52), mag: 3.45, bv: 0.03, name: 'Tania Borealis', bayer: 'λ UMa', con: 'UMa' },
  { id: 'Mu UMa', hip: 50801, ra: ra(10, 22, 19.7), dec: dec(41, 29, 58), mag: 3.06, bv: 1.59, name: 'Tania Australis', bayer: 'μ UMa', con: 'UMa' },
  { id: 'Nu UMa', hip: 55219, ra: ra(11, 18, 28.7), dec: dec(33, 5, 39), mag: 3.48, bv: 1.40, name: 'Alula Borealis', bayer: 'ν UMa', con: 'UMa' },
  { id: 'Xi UMa', hip: 55203, ra: ra(11, 18, 10.9), dec: dec(31, 31, 45), mag: 3.79, bv: 0.59, name: 'Alula Australis', bayer: 'ξ UMa', con: 'UMa' },
  { id: 'Psi UMa', hip: 54539, ra: ra(11, 9, 39.8), dec: dec(44, 29, 55), mag: 3.01, bv: 1.14, bayer: 'ψ UMa', con: 'UMa' },
  { id: 'Omicron UMa', hip: 41704, ra: ra(8, 30, 15.9), dec: dec(60, 43, 5), mag: 3.35, bv: 0.85, name: 'Muscida', bayer: 'ο UMa', con: 'UMa' },
  { id: 'Beta Aql', hip: 98036, ra: ra(19, 55, 18.8), dec: dec(6, 24, 24), mag: 3.71, bv: 0.86, name: 'Alshain', bayer: 'β Aql', con: 'Aql' },
  { id: 'Zeta Aql', hip: 93747, ra: ra(19, 5, 24.6), dec: dec(13, 51, 49), mag: 2.99, bv: 0.01, name: 'Okab', bayer: 'ζ Aql', con: 'Aql' },
  { id: 'Delta Aql', hip: 95501, ra: ra(19, 25, 29.9), dec: dec(3, 6, 53), mag: 3.36, bv: 0.32, bayer: 'δ Aql', con: 'Aql' },
  { id: 'Lambda Aql', hip: 93805, ra: ra(19, 6, 14.9), dec: dec(-4, 52, 57), mag: 3.43, bv: -0.09, bayer: 'λ Aql', con: 'Aql' },
  { id: 'Theta Aql', hip: 99473, ra: ra(20, 11, 18.3), dec: dec(-0, 49, 17), mag: 3.24, bv: -0.07, bayer: 'θ Aql', con: 'Aql' },
  { id: 'Eta Aql', hip: 97804, ra: ra(19, 52, 28.4), dec: dec(1, 0, 20), mag: 3.87, bv: 0.80, bayer: 'η Aql', con: 'Aql' },
  { id: 'Alpha Vul', hip: 95771, ra: ra(19, 28, 42.3), dec: dec(24, 39, 54), mag: 4.44, bv: 1.51, name: 'Anser', bayer: 'α Vul', con: 'Vul' },
  { id: 'Alpha Sct', hip: 91117, ra: ra(18, 35, 12.4), dec: dec(-8, 14, 39), mag: 3.85, bv: 1.33, bayer: 'α Sct', con: 'Sct' },
  { id: 'Gamma Boo', hip: 71075, ra: ra(14, 32, 4.7), dec: dec(38, 18, 30), mag: 3.04, bv: 0.19, bayer: 'γ Boo', con: 'Boo' },
  { id: 'Beta Com', hip: 64394, ra: ra(13, 11, 52.4), dec: dec(27, 52, 41), mag: 4.26, bv: 0.57, bayer: 'β Com', con: 'Com' },
  { id: 'Alpha Com', hip: 64241, ra: ra(13, 9, 59.3), dec: dec(17, 31, 46), mag: 4.32, bv: 0.45, name: 'Diadem', bayer: 'α Com', con: 'Com' },
  { id: 'Gamma Com', hip: 60742, ra: ra(12, 26, 56.3), dec: dec(28, 16, 6), mag: 4.35, bv: 1.13, bayer: 'γ Com', con: 'Com' },
  { id: 'Beta CrB', hip: 75695, ra: ra(15, 27, 49.7), dec: dec(29, 6, 20), mag: 3.66, bv: 0.27, name: 'Nusakan', bayer: 'β CrB', con: 'CrB' },
  { id: 'Gamma CrB', hip: 76952, ra: ra(15, 42, 44.6), dec: dec(26, 17, 44), mag: 3.81, bv: -0.02, bayer: 'γ CrB', con: 'CrB' },
  { id: 'Delta CrB', hip: 77512, ra: ra(15, 49, 35.7), dec: dec(26, 4, 6), mag: 4.59, bv: 0.80, bayer: 'δ CrB', con: 'CrB' },
  { id: 'Epsilon CrB', hip: 78159, ra: ra(15, 57, 35.3), dec: dec(26, 52, 40), mag: 4.14, bv: 1.23, bayer: 'ε CrB', con: 'CrB' },
  { id: 'Theta CrB', hip: 76127, ra: ra(15, 32, 55.8), dec: dec(31, 21, 33), mag: 4.14, bv: -0.13, bayer: 'θ CrB', con: 'CrB' },
  { id: 'Delta Oph', hip: 79593, ra: ra(16, 14, 20.7), dec: dec(-3, 41, 40), mag: 2.73, bv: 1.59, name: 'Yed Prior', bayer: 'δ Oph', con: 'Oph' },
  { id: 'Epsilon Oph', hip: 79882, ra: ra(16, 18, 19.3), dec: dec(-4, 41, 33), mag: 3.23, bv: 0.96, name: 'Yed Posterior', bayer: 'ε Oph', con: 'Oph' },
  { id: 'Zeta Oph', hip: 81377, ra: ra(16, 37, 9.5), dec: dec(-10, 34, 2), mag: 2.54, bv: 0.02, bayer: 'ζ Oph', con: 'Oph' },
  { id: 'Kappa Oph', hip: 83000, ra: ra(16, 57, 40.1), dec: dec(9, 22, 30), mag: 3.19, bv: 1.15, bayer: 'κ Oph', con: 'Oph' },
  { id: 'Gamma Per2', hip: 17358, ra: ra(3, 42, 55.5), dec: dec(47, 47, 15), mag: 3.01, bv: -0.12, bayer: 'δ Per', con: 'Per' },
  { id: 'Rho Per', hip: 14354, ra: ra(3, 5, 10.6), dec: dec(38, 50, 25), mag: 3.39, bv: 1.65, bayer: 'ρ Per', con: 'Per' },
  { id: 'Eta Per', hip: 13268, ra: ra(2, 50, 41.8), dec: dec(55, 53, 44), mag: 3.76, bv: 1.69, name: 'Miram', bayer: 'η Per', con: 'Per' },
  { id: 'Gamma Cyg2', hip: 104732, ra: ra(21, 12, 56.2), dec: dec(30, 13, 37), mag: 3.21, bv: 0.99, bayer: 'ζ Cyg', con: 'Cyg' },
  { id: 'Eta Cyg', hip: 98110, ra: ra(19, 56, 18.4), dec: dec(35, 5, 0), mag: 3.89, bv: 1.03, bayer: 'η Cyg', con: 'Cyg' },
  { id: 'Kappa Cyg', hip: 94779, ra: ra(19, 17, 6.2), dec: dec(53, 22, 7), mag: 3.80, bv: 0.96, bayer: 'κ Cyg', con: 'Cyg' },
  { id: 'Iota Cyg', hip: 95853, ra: ra(19, 29, 42.3), dec: dec(51, 43, 47), mag: 3.76, bv: 0.14, bayer: 'ι² Cyg', con: 'Cyg' },
  { id: 'Gamma Aur', hip: 28358, ra: ra(5, 59, 31.7), dec: dec(44, 56, 51), mag: 1.90, bv: 0.03, bayer: 'β Aur', con: 'Aur' },
  { id: 'Theta2 Tau', hip: 20894, ra: ra(4, 28, 39.7), dec: dec(15, 52, 15), mag: 3.40, bv: 0.18, name: 'Chamukuy', bayer: 'θ² Tau', con: 'Tau' },
  { id: 'Gamma Tau', hip: 20205, ra: ra(4, 19, 47.6), dec: dec(15, 37, 40), mag: 3.65, bv: 0.99, name: 'Prima Hyadum', bayer: 'γ Tau', con: 'Tau' },
  { id: 'Beta Mon', hip: 30867, ra: ra(6, 28, 49.1), dec: dec(-7, 1, 59), mag: 3.76, bv: -0.10, bayer: 'β Mon', con: 'Mon' },
  { id: 'Alpha Mon', hip: 37447, ra: ra(7, 41, 14.8), dec: dec(-9, 33, 4), mag: 3.94, bv: 1.02, bayer: 'α Mon', con: 'Mon' },
  { id: 'Gamma Mon', hip: 29651, ra: ra(6, 14, 51.3), dec: dec(-6, 16, 29), mag: 3.99, bv: 1.32, bayer: 'γ Mon', con: 'Mon' },
  { id: 'Beta Lep', hip: 25606, ra: ra(5, 28, 14.7), dec: dec(-20, 45, 34), mag: 2.81, bv: 0.82, name: 'Nihal', bayer: 'β Lep', con: 'Lep' },
  { id: 'Epsilon Lep', hip: 23685, ra: ra(5, 5, 27.7), dec: dec(-22, 22, 16), mag: 3.19, bv: 1.46, bayer: 'ε Lep', con: 'Lep' },
  { id: 'Mu Lep', hip: 24244, ra: ra(5, 12, 55.9), dec: dec(-16, 12, 20), mag: 3.29, bv: -0.11, bayer: 'μ Lep', con: 'Lep' },
  { id: 'Alpha Lac', hip: 111104, ra: ra(22, 31, 17.5), dec: dec(50, 16, 57), mag: 3.76, bv: 0.01, bayer: 'α Lac', con: 'Lac' },
  { id: 'Alpha Lyn', hip: 45860, ra: ra(9, 21, 3.3), dec: dec(34, 23, 33), mag: 3.14, bv: 1.55, bayer: 'α Lyn', con: 'Lyn' },
  { id: 'Alpha LMi', hip: 53229, ra: ra(10, 53, 18.7), dec: dec(34, 12, 54), mag: 3.79, bv: 1.05, name: 'Praecipua', bayer: '46 LMi', con: 'LMi' },
  { id: 'Delta Cru', hip: 59747, ra: ra(12, 15, 8.7), dec: dec(-58, 44, 56), mag: 2.79, bv: -0.19, name: 'Imai', bayer: 'δ Cru', con: 'Cru' },
  { id: 'Gamma Cen', hip: 61932, ra: ra(12, 41, 31.0), dec: dec(-48, 57, 36), mag: 2.20, bv: -0.02, bayer: 'γ Cen', con: 'Cen' },
  { id: 'Epsilon Cen', hip: 66657, ra: ra(13, 39, 53.3), dec: dec(-53, 27, 59), mag: 2.29, bv: -0.22, bayer: 'ε Cen', con: 'Cen' },
  { id: 'Eta Cen', hip: 71352, ra: ra(14, 35, 30.4), dec: dec(-42, 9, 28), mag: 2.33, bv: -0.19, bayer: 'η Cen', con: 'Cen' },
  { id: 'Zeta Cen', hip: 68002, ra: ra(13, 55, 32.4), dec: dec(-47, 17, 18), mag: 2.55, bv: -0.22, bayer: 'ζ Cen', con: 'Cen' },
  { id: 'Delta Cen', hip: 59196, ra: ra(12, 8, 21.5), dec: dec(-50, 43, 21), mag: 2.58, bv: -0.12, bayer: 'δ Cen', con: 'Cen' },
  { id: 'Iota Cen', hip: 65109, ra: ra(13, 20, 35.8), dec: dec(-36, 42, 44), mag: 2.75, bv: 0.04, bayer: 'ι Cen', con: 'Cen' },
  { id: 'Gamma Vel', hip: 39953, ra: ra(8, 9, 32.0), dec: dec(-47, 20, 12), mag: 1.75, bv: -0.22, name: 'Regor', bayer: 'γ² Vel', con: 'Vel' },
  { id: 'Kappa Vel', hip: 45941, ra: ra(9, 22, 6.8), dec: dec(-55, 0, 38), mag: 2.47, bv: -0.18, name: 'Markeb', bayer: 'κ Vel', con: 'Vel' },
  { id: 'Iota Car', hip: 45556, ra: ra(9, 17, 5.4), dec: dec(-59, 16, 31), mag: 2.21, bv: 0.18, name: 'Aspidiske', bayer: 'ι Car', con: 'Car' },
  { id: 'Theta Car', hip: 52419, ra: ra(10, 42, 57.4), dec: dec(-64, 23, 40), mag: 2.74, bv: -0.22, bayer: 'θ Car', con: 'Car' },
  { id: 'Eta Car', hip: 52633, ra: ra(10, 45, 3.6), dec: dec(-59, 41, 4), mag: 4.30, bv: 0.61, name: 'Eta Carinae', koName: '용골자리 에타', bayer: 'η Car', con: 'Car' },
  { id: 'Alpha Tuc', hip: 110130, ra: ra(22, 18, 30.1), dec: dec(-60, 15, 35), mag: 2.87, bv: 1.39, bayer: 'α Tuc', con: 'Tuc' },
  { id: 'Beta Hydri', hip: 2021, ra: ra(0, 25, 45.1), dec: dec(-77, 15, 15), mag: 2.82, bv: 0.62, bayer: 'β Hyi', con: 'Hyi' },
  { id: 'Alpha Lup', hip: 71860, ra: ra(14, 41, 55.8), dec: dec(-47, 23, 18), mag: 2.30, bv: -0.20, bayer: 'α Lup', con: 'Lup' },
  { id: 'Beta Lup', hip: 73273, ra: ra(14, 58, 31.9), dec: dec(-43, 8, 2), mag: 2.68, bv: -0.22, bayer: 'β Lup', con: 'Lup' },
  { id: 'Alpha Ara', hip: 85792, ra: ra(17, 31, 50.5), dec: dec(-49, 52, 34), mag: 2.85, bv: -0.17, bayer: 'α Ara', con: 'Ara' },
  { id: 'Beta Ara', hip: 85258, ra: ra(17, 25, 18.0), dec: dec(-55, 31, 48), mag: 2.84, bv: 1.46, bayer: 'β Ara', con: 'Ara' },
  { id: 'Gamma TrA', hip: 74946, ra: ra(15, 18, 54.6), dec: dec(-68, 40, 46), mag: 2.87, bv: 0.00, bayer: 'γ TrA', con: 'TrA' },
  { id: 'Pi Pup', hip: 35264, ra: ra(7, 17, 8.6), dec: dec(-37, 5, 51), mag: 2.71, bv: 1.62, bayer: 'π Pup', con: 'Pup' },
  { id: 'Rho Pup', hip: 39757, ra: ra(8, 7, 32.6), dec: dec(-24, 18, 16), mag: 2.83, bv: 0.43, name: 'Tureis', bayer: 'ρ Pup', con: 'Pup' },
  { id: 'Tau Pup', hip: 32768, ra: ra(6, 49, 56.2), dec: dec(-50, 36, 53), mag: 2.94, bv: 1.20, bayer: 'τ Pup', con: 'Pup' },
  { id: 'Alpha Dor', hip: 21281, ra: ra(4, 33, 59.8), dec: dec(-55, 2, 42), mag: 3.30, bv: -0.10, bayer: 'α Dor', con: 'Dor' },
  { id: 'Alpha Pic', hip: 32607, ra: ra(6, 48, 11.5), dec: dec(-61, 56, 29), mag: 3.30, bv: 0.21, bayer: 'α Pic', con: 'Pic' },
  { id: 'Gamma Hya', hip: 64962, ra: ra(13, 18, 55.3), dec: dec(-23, 10, 17), mag: 2.99, bv: 0.92, bayer: 'γ Hya', con: 'Hya' },
  { id: 'Zeta Hya', hip: 43813, ra: ra(8, 55, 23.6), dec: dec(5, 56, 44), mag: 3.11, bv: 1.00, bayer: 'ζ Hya', con: 'Hya' },
  { id: 'Nu Hya', hip: 52943, ra: ra(10, 49, 37.5), dec: dec(-16, 11, 37), mag: 3.11, bv: 1.25, bayer: 'ν Hya', con: 'Hya' },
  { id: 'Pi Hya', hip: 68895, ra: ra(14, 6, 22.3), dec: dec(-26, 40, 56), mag: 3.25, bv: 1.12, bayer: 'π Hya', con: 'Hya' },
  { id: 'Epsilon Hya', hip: 43109, ra: ra(8, 46, 46.5), dec: dec(6, 25, 7), mag: 3.38, bv: 0.68, name: 'Ashlesha', bayer: 'ε Hya', con: 'Hya' },
  { id: 'Alpha Scl', hip: 4577, ra: ra(0, 58, 36.4), dec: dec(-29, 21, 27), mag: 4.30, bv: -0.16, bayer: 'α Scl', con: 'Scl' },
  { id: 'Alpha For', hip: 14879, ra: ra(3, 12, 4.5), dec: dec(-28, 59, 15), mag: 3.80, bv: 0.51, name: 'Dalim', bayer: 'α For', con: 'For' },
  { id: 'Zeta Aur', hip: 23453, ra: ra(5, 2, 28.7), dec: dec(41, 4, 33), mag: 3.69, bv: 1.22, name: 'Saclateni', bayer: 'ζ Aur', con: 'Aur' },
  { id: 'Epsilon Aur', hip: 23416, ra: ra(5, 1, 58.1), dec: dec(43, 49, 24), mag: 3.03, bv: 0.54, name: 'Almaaz', bayer: 'ε Aur', con: 'Aur' },
  { id: 'Eta Aur', hip: 23767, ra: ra(5, 6, 30.9), dec: dec(41, 14, 4), mag: 3.18, bv: -0.18, name: 'Haedus', bayer: 'η Aur', con: 'Aur' },
  { id: 'Alcor', hip: 65477, ra: ra(13, 25, 13.5), dec: dec(54, 59, 17), mag: 3.99, bv: 0.16, name: 'Alcor', koName: '알코르', bayer: '80 UMa', con: 'UMa' },
];

/**
 * Deterministic tile-based faint field star generator (Level of Detail down to mag 10.5).
 * Generates repeatable pseudo-Tycho/Gaia field stars per 5x5 degree sky cell so stars
 * remain fixed to exact celestial RA/Dec coordinates when panning and zooming!
 */
export function getFieldStarsInBounds(
  raMinDeg: number,
  raMaxDeg: number,
  decMinDeg: number,
  decMaxDeg: number,
  magLimit: number
): Star[] {
  if (magLimit <= 4.6) return [];

  const CELL_DEG = 5;
  const results: Star[] = [];

  const decStart = Math.max(-85, Math.floor(decMinDeg / CELL_DEG) * CELL_DEG);
  const decEnd = Math.min(85, Math.floor(decMaxDeg / CELL_DEG) * CELL_DEG);

  // Handle RA wrapping around 0/360 smoothly
  const raSpan = raMaxDeg - raMinDeg;
  const cellsRa: number[] = [];
  if (raSpan >= 355) {
    for (let r = 0; r < 360; r += CELL_DEG) cellsRa.push(r);
  } else {
    const startCell = Math.floor(raMinDeg / CELL_DEG) * CELL_DEG;
    const endCell = Math.floor(raMaxDeg / CELL_DEG) * CELL_DEG;
    for (let r = startCell; r <= endCell; r += CELL_DEG) {
      cellsRa.push(((r % 360) + 360) % 360);
    }
  }

  for (let d = decStart; d <= decEnd; d += CELL_DEG) {
    // Cosine factor so polar regions don't artificially crowd
    const cosDec = Math.max(0.15, Math.cos(((d + CELL_DEG / 2) * Math.PI) / 180));

    for (const r of cellsRa) {
      // Base seed from cell coordinates
      let seed = ((r * 73856093) ^ ((d + 90) * 19349663)) >>> 0;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      // Galactic plane density boost (~60° tilted belt roughly peaking near RA 270 / 90)
      const galBoost =
        1 +
        1.1 *
          Math.exp(
            -Math.pow(
              Math.sin(((r - 275) * Math.PI) / 180) * 0.65 +
                Math.sin(((d + 25) * Math.PI) / 180) * 0.45,
              2
            ) * 6
          );

      // Stars per 5x5 cell scales exponentially with magnitude limit
      const baseCount = Math.min(34, Math.floor(Math.pow(1.65, magLimit - 4.5) * 1.4 * cosDec * galBoost));

      for (let i = 0; i < baseCount; i++) {
        const u1 = nextRand();
        const u2 = nextRand();
        const u3 = nextRand();
        const u4 = nextRand();

        // Magnitude distribution weighted toward fainter magnitudes
        const mag = 4.6 + Math.pow(u3, 0.55) * Math.max(0.5, magLimit - 4.6);
        if (mag > magLimit) continue;

        const starRa = (r + u1 * CELL_DEG) % 360;
        const starDec = d + u2 * CELL_DEG;
        const bv = -0.15 + u4 * 1.65;

        results.push({
          id: `TYC-${r}-${d}-${i}`,
          ra: starRa,
          dec: starDec,
          mag,
          bv,
          con: '',
        });
      }
    }
  }

  return results;
}
