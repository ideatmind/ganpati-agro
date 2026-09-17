import assert from "node:assert/strict";
import test from "node:test";
import { CROP_CATEGORIES, CLUSTER_OPTIONS } from "../src/shared/crop-catalog.ts";
import { registrationSchema } from "../src/features/registration/schema.ts";
import { profileChangesSchema } from "../src/features/registration/profile-schema.ts";
import { validationFeedback } from "../src/shared/validation-feedback.ts";

const registration = {
  name: "Crop Test", mobile: "8000000098", password: "test1234",
  aadhar_no: "123456789012", date_of_birth: "1990-01-01",
  village: "Test village", district: "dharashiv", taluka: "dharashiv",
  income_source: "agriculture", consent: true,
};

test("all 13 crop categories and their crops can be registered", () => {
  assert.deepEqual(CLUSTER_OPTIONS, ["cereals", "pulses", "oilseeds", "cash", "fruits", "vegs", "spices", "flowers", "medicinal", "mushroom", "allied", "protected", "agroforestry"]);
  assert.deepEqual(CROP_CATEGORIES.map(category => category.crops.length), [5, 6, 6, 3, 16, 18, 6, 6, 5, 3, 7, 6, 3]);
  for (const category of CROP_CATEGORIES) {
    assert.ok(profileChangesSchema.safeParse({cluster_type: category.id}).success);
    for (const crop of category.crops) {
      assert.ok(registrationSchema.safeParse({...registration, cluster_type: category.id, plots: [{plot_no: "1", area_acres: 1, crop_name: crop, irrigation_source: "well"}]}).success, `${category.id}: ${crop}`);
    }
  }
});

test("registration rejects crops and clusters outside the catalog", () => {
  const input = {...registration, cluster_type: "oilseeds", plots: [{plot_no: "1", area_acres: 1, crop_name: "सोयाबीन", irrigation_source: "well"}]};
  assert.ok(registrationSchema.safeParse(input).success);
  assert.equal(registrationSchema.safeParse({...input, cluster_type: "unknown"}).success, false);
  for (const crop_name of ["", "Unknown crop", "सिताफळ"]) {
    const result = registrationSchema.safeParse({...input, plots: [{...input.plots[0], crop_name}]});
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some(issue => issue.path.join(".") === "plots.0.crop_names.0"));
  }
});

test("each plot must use a crop from the selected cluster", () => {
  const plot={plot_no:"1",area_acres:1,crop_name:"तूर",irrigation_source:"well"};
  const input={...registration,cluster_type:"pulses",plots:[plot,{...plot,plot_no:"2",crop_name:"सोयाबीन"}]};
  const result=registrationSchema.safeParse(input);
  assert.equal(result.success,false);
  assert.ok(result.error?.issues.some(issue=>issue.path.join('.')==='plots.1.crop_names'));
  assert.ok(registrationSchema.safeParse({...input,plots:[plot,{...plot,plot_no:"2",crop_name:"हरभरा"}]}).success);
  for(const cluster_type of ['spices','vegs'])assert.ok(registrationSchema.safeParse({...input,cluster_type,plots:[{...plot,crop_name:"मिरची"}]}).success);
});

test("multi-select plots validate every value and normalize legacy single selections", () => {
  const plot = {plot_no:"1", area_acres:2, crop_names:["तूर","हरभरा"], irrigation_sources:["well","drip"]};
  const input = {...registration, cluster_type:"pulses", plots:[plot, {...plot, plot_no:"2", crop_names:["मूग"]}]};
  assert.deepEqual(registrationSchema.parse(input).plots, input.plots);
  const legacy = registrationSchema.parse({...input, plots:[{plot_no:"1",area_acres:2,crop_name:"तूर",irrigation_source:"well"}]}).plots[0];
  assert.deepEqual(legacy.crop_names,["तूर"]);
  assert.deepEqual(legacy.irrigation_sources,["well"]);
  for (const change of [
    {crop_names:[]}, {crop_names:["तूर","तूर"]}, {crop_names:["तूर","सोयाबीन"]},
    {crop_names:["तूर","Unknown"]}, {crop_names:"तूर"}, {crop_names:[null]},
    {irrigation_sources:[]}, {irrigation_sources:["well","well"]},
    {irrigation_sources:["well","unknown"]}, {irrigation_sources:"well"},
  ]) assert.equal(registrationSchema.safeParse({...input, plots:[{...plot,...change}]}).success,false);
  const invalid = registrationSchema.safeParse({...input, plots:[{...plot,irrigation_sources:["well","unknown"]}]});
  assert.equal(invalid.success,false);
  if (!invalid.success) assert.equal(validationFeedback(invalid.error).field,"plots.0.irrigation_sources");
});
