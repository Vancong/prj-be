const { date } = require('joi');
const createError=require('../helper/createError');
const VoucherDtb=require('../models/Voucher.Model');
const paginationHelper=require('../helper/pagination');
const OrderDtb=require('../models/Order.Model');

module.exports.create= async(data) =>{
    const checkVoucher=await VoucherDtb.findOne({
        code: data.code
    })
    if(checkVoucher) {
        throw createError(401, 'Đã tồn tại voucher ')
    }
    if(data.startDate>date.endDate) {
        throw createError(400,'Dữ liệu không hơp lệ')
    }

    const voucher= VoucherDtb.create(data);
    return {
        status: 'OK',
        message: 'Tạo voucher thành công',
        data: voucher
    }
}

module.exports.getAll= async(page,limit,search, isAdmin) =>{
 
    const query={};
    if(!isAdmin) {
        query.isActive=true;
    }
    if (search && search.trim() !== '') {
            query.code = { $regex: search.trim(), $options: 'i' };
    }
   
    return await paginationHelper({
        model: VoucherDtb,
        page,
        limit,
        query
    });
    
}

module.exports.update= async(data,id) =>{
    const voucher=await VoucherDtb.findById(id)

    if(!voucher) {
        throw createError('404','Khong tim thay')
    }

    await VoucherDtb.updateOne({
        _id:id
    },data)
   
    return {
        status: 'OK',
        message: ' thành công',
    }
}

module.exports.delete= async(id) =>{
    const voucher=await VoucherDtb.findById(id)
    if(!voucher) {
        throw createError('404','Khong tim thay')
    }

    await VoucherDtb.deleteOne({
        _id:id
    })
   
    return {
        status: 'OK',
        message: ' thành công',
    }
}

module.exports.deleteMany= async(ids) =>{
    console.log(ids)
    await VoucherDtb.deleteMany({
        _id: {$in:ids}
    })
   
    return {
        status: 'OK',
        message: ' thành công',
    }
}

module.exports.check= async(userId,code,totalPrice) =>{
    const voucher= await VoucherDtb.findOne({
        code:code?.trim(),
        isActive:true
    })

    if (!voucher) {
     throw createError(400, 'Mã giảm giá không tồn tại');
    }

    const endDate = new Date(voucher.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (endDate < new Date() || voucher.minOrderValue > totalPrice) {
        throw createError(400, 'Mã giảm giá không hợp lệ');
    }

    if (totalPrice < voucher.minOrderValue) {
      throw new Error(`Đơn hàng phải tối thiểu ${voucher.minOrderValue}`);
    }

    if (voucher.startDate && new Date(voucher.startDate) > new Date()) {
        throw createError(400, 'Mã giảm giá chưa đến thời gian sử dụng');
    }

    const userUsed = voucher.usedBy.find(us => us.userId.toString() === userId);
    const usedCount = userUsed ? userUsed.count : 0;

    if(voucher.userLimit&& voucher.userLimit>=usedCount) {
         throw createError(400,'Bạn đã dùng quá số lần')
    }

    let discountValue = 0;
    if (voucher.discountType === 'percentage') {
        discountValue = (voucher.discountValue / 100) * totalPrice;
        if (voucher.maxDiscountValue && discountValue > voucher.maxDiscountValue) {
            discountValue = voucher.maxDiscountValue;
        }
    } else if (voucher.discountType === 'fixed') {
        discountValue = voucher.discountValue;
    }



    return {
        status: 'OK',
        message: ' thành công',
        data:{
            isSuccess:true,
            voucher: voucher,
            discountValue: discountValue
        }
    }
}
